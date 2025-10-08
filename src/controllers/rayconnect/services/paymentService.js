const { query } = require('../config/database');
const { sendSMS } = require('./smsService');
const { generateBioliteCode } = require('./bioliteService');
const { getActivationCode } = require('./beebeeService');
const { generateToken, TokenType } = require('./openPayGoService');
const { getBusinessCredentials } = require('./utils');

const handleSuccessfulPayment = async (client, userId, amount, paymentId, loanId = null, business_id, isInitialPayment = false) => {
  try {
    const credentials = await getBusinessCredentials(business_id);
    if (!credentials) {
      throw new Error(`Could not retrieve credentials for business ${business_id}`);
    }

    let token = null;
    let tokenExpirationDays = 30;
    let deviceId = null
    if (loanId) {
      const loanResult = await client.query('SELECT l.payment_amount_per_cycle, l.device_id, l.payment_frequency, l.payment_cycle_amount, dt.token_validity_days FROM ray_loans l JOIN ray_devices d ON l.device_id = d.id JOIN ray_device_types dt ON d.device_type_id = dt.id WHERE l.id = $1 AND l.business_id = $2', [loanId, business_id]);
      if (loanResult.rows.length > 0) {
        const { device_id, payment_frequency, payment_cycle_amount, token_validity_days } = loanResult.rows[0];
        deviceId = device_id;
        if (isInitialPayment && token_validity_days) {
            tokenExpirationDays = token_validity_days;
        } else {
            if (amount >= payment_cycle_amount && payment_cycle_amount > 0) {
                const extraAmount = amount - payment_cycle_amount;
                let days_in_cycle;
                switch (payment_frequency) {
                  case 'daily': days_in_cycle = 1; break;
                  case 'weekly': days_in_cycle = 7; break;
                  default: days_in_cycle = 30; break;
                }
                tokenExpirationDays = Math.floor(days_in_cycle + (extraAmount / payment_cycle_amount) * days_in_cycle);
            } else {
                switch (payment_frequency) {
                  case 'daily': tokenExpirationDays = 1; break;
                  case 'weekly': tokenExpirationDays = 7; break;
                  default: tokenExpirationDays = 30; break;
                }
            }
        }

        const deviceResult = await client.query('SELECT d.serial_number, d.non_tokenised, dt.manufacturer, d.openpaygo_secret_key, d.openpaygo_token_count FROM ray_devices d JOIN ray_device_types dt on d.device_type_id = dt.id WHERE d.id = $1 AND d.business_id = $2', [device_id, business_id]);
        const serialNum = deviceResult.rows.length > 0 ? deviceResult.rows[0].serial_number : null;
        const manufacturer = deviceResult.rows.length > 0 ? deviceResult.rows[0].manufacturer : null;
        const isNonTokenised = deviceResult.rows.length > 0 ? deviceResult.rows[0].non_tokenised : false;
        const openpaygo_secret_key = deviceResult.rows.length > 0 ? deviceResult.rows[0].openpaygo_secret_key : null;
        const openpaygo_token_count = deviceResult.rows.length > 0 ? deviceResult.rows[0].openpaygo_token_count : 0;
        if (serialNum) {
            if (manufacturer === 'biolite' && credentials.biolite_private_key) {
                const bioliteResponse = await generateBioliteCode(serialNum, 'add_time', tokenExpirationDays, credentials);
                if (!bioliteResponse || !bioliteResponse.codeStr) {
                    throw new Error(`BioLite service did not return a valid activation code for SN ${serialNum}.`);
                }
                token = bioliteResponse.codeStr;
                console.log(`Generated BioLite code for device ${serialNum}: ${token}`);
            } else if (manufacturer === 'beebeejumpi' && !isNonTokenised) {
                const beebeeResponse = await getActivationCode(serialNum, `${tokenExpirationDays}Days`);
                if (beebeeResponse && beebeeResponse.data && beebeeResponse.data.activationCode) {
                    token = beebeeResponse.data.activationCode;
                    console.log(`Generated BeeBeeJump code for device ${serialNum} ${tokenExpirationDays} days: ${token}`);
                } else {
                    throw new Error(`BeeBeeJump service did not return a valid activation code for SN ${serialNum}.`);
                }
            } else if (manufacturer === 'solarun') {
                if (!openpaygo_secret_key) {
                    throw new Error(`OpenPAYGO device ${serialNum} does not have a secret key.`);
                }
                console.log({openpaygo_secret_key, tokenExpirationDays, openpaygo_token_count});
                const { updatedCount, token: generatedToken } = generateToken(openpaygo_secret_key, tokenExpirationDays, openpaygo_token_count, TokenType.COUNTER_SYNC);
                token = generatedToken;
                console.log(`Generated OpenPAYGO code for device ${serialNum}: ${token}`);
                // Update token count
                await client.query('UPDATE ray_devices SET openpaygo_token_count = $1 WHERE id = $2', [updatedCount, device_id]);
            } else if (manufacturer === 'beebeejump' && isNonTokenised) {
                // For Ray devices, we generate a random 6-digit token
                token = Math.floor(100000 + Math.random() * 900000).toString();
                console.log(`Generated Ray device token: ${token}`);
            } else {
              token = Math.floor(100000 + Math.random() * 900000).toString();
                // throw new Error(`Token generation for unsupported manufacturer: '${manufacturer}'`);
            }
        } else if (loanId) {
            throw new Error(`Could not find serial number for device associated with loan ${loanId}. Cannot generate token.`);
        }
      }
    }
    if (!token) {
        token = Math.floor(100000 + Math.random() * 900000).toString();
    }

    await client.query(
      'INSERT INTO ray_tokens (user_id, token, payment_id, expires_at, business_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, token, paymentId, new Date(Date.now() + tokenExpirationDays * 24 * 60 * 60 * 1000), business_id]
    );

    const user = await client.query('SELECT phone_number FROM ray_users WHERE id = $1 AND business_id = $2', [userId, business_id]);
    const userContact = user.rows[0] ? user.rows[0].phone_number : null;

    if (userContact && credentials.africastalking_api_key) {
      const message = `Your PayGo activation code is: ${token}. Amount paid: ${amount}. Valid for ${tokenExpirationDays} days.`;
      await sendSMS(userContact, message, credentials);
      console.log(`Activation code ${token} sent to user ${userId} via SMS ${tokenExpirationDays}days.`);
    }

    const assignedDevices = await client.query(
      'SELECT assigned_by FROM ray_devices WHERE assigned_to = $1 AND assigned_by IS NOT NULL AND business_id = $2',
      [userId, business_id]
    );

    if (assignedDevices.rows.length > 0) {
      const agentId = assignedDevices.rows[0].assigned_by;
      const agentResult = await client.query('SELECT commission_rate, super_agent_id, role FROM ray_users WHERE id = $1 AND business_id = $2', [agentId, business_id]);

      if (agentResult.rows.length > 0) {
        const agent = agentResult.rows[0];
        let commissionAmount = 0;
        let commissionRate = 0; // Initialize commissionRate

        // Fetch first-time commission settings
        const firstTimeCommissionSetting = await client.query(
          'SELECT commission_amount FROM first_time_commission_settings WHERE business_id = $1',
          [business_id]
        );
        const fixedFirstTimeCommission = firstTimeCommissionSetting.rows.length > 0
          ? parseFloat(firstTimeCommissionSetting.rows[0].commission_amount)
          : 0;

        // Check device's first_time_commission_paid status
        const deviceCommissionStatus = await client.query(
          'SELECT first_time_commission_paid FROM ray_devices WHERE id = $1 AND business_id = $2',
          [deviceId, business_id] 
        );
        const hasPaidFirstTimeCommission = deviceCommissionStatus.rows.length > 0
          ? deviceCommissionStatus.rows[0].first_time_commission_paid
          : false;

        if (!hasPaidFirstTimeCommission && fixedFirstTimeCommission > 0) {
          // Apply fixed first-time commission
          commissionAmount = fixedFirstTimeCommission;
          commissionRate = 0; // Fixed amount, so rate is not directly applicable here for logging
          await client.query(
            'UPDATE ray_devices SET first_time_commission_paid = TRUE WHERE id = $1 AND business_id = $2',
            [deviceId, business_id]
          );
          console.log(`Applied first-time commission of ${commissionAmount} for device ${deviceId} to agent ${agentId}`);
        } else {
          // Mark first-time commission as paid if not already so that it doesn't get applied again
          await client.query(
            'UPDATE ray_devices SET first_time_commission_paid = TRUE WHERE id = $1 AND business_id = $2',
            [deviceId, business_id]
          );
          // Apply regular commission logic
          commissionRate = agent.commission_rate;
          if (!commissionRate || commissionRate == 0) {
              const generalRate = await client.query("SELECT setting_value FROM ray_settings WHERE setting_key = $1 AND business_id = $2", ['general_agent_commission_rate', business_id]);
              if(generalRate.rows.length > 0) commissionRate = parseFloat(generalRate.rows[0].setting_value);
          }

          if(commissionRate > 0) {
              commissionAmount = (amount * commissionRate) / 100;
          }
        }

        if(commissionAmount > 0) {
            const superAgentId = agent.super_agent_id;
            if (superAgentId) {
                const superAgentResult = await client.query('SELECT commission_rate FROM ray_users WHERE id = $1 AND business_id = $2', [superAgentId, business_id]);
                if (superAgentResult.rows.length > 0) {
                    let superAgentCommissionRate = superAgentResult.rows[0].commission_rate;
                    if (!superAgentCommissionRate || superAgentCommissionRate == 0) {
                        const generalSuperRate = await client.query("SELECT setting_value FROM ray_settings WHERE setting_key = $1 AND business_id = $2", ['general_super_agent_commission_rate', business_id]);
                        if(generalSuperRate.rows.length > 0) superAgentCommissionRate = parseFloat(generalSuperRate.rows[0].setting_value);
                    }

                    if(superAgentCommissionRate > 0) {
                        const superAgentCommissionAmount = (commissionAmount * superAgentCommissionRate) / 100;
                        const agentCommission = commissionAmount - superAgentCommissionAmount;

                        const newCommission = await client.query(
                          'INSERT INTO ray_commissions (agent_id, customer_id, payment_id, amount, commission_percentage, business_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                          [agentId, userId, paymentId, agentCommission, commissionRate, business_id]
                        );
                        await client.query(
                          'INSERT INTO ray_super_agent_commissions (super_agent_id, agent_id, original_commission_id, amount, commission_percentage, business_id) VALUES ($1, $2, $3, $4, $5, $6)',
                          [superAgentId, agentId, newCommission.rows[0].id, superAgentCommissionAmount, superAgentCommissionRate, business_id]
                        );
                    }
                }
            } else {
                const commm =
                await client.query(
                  'INSERT INTO ray_commissions (agent_id, customer_id, payment_id, amount, commission_percentage, business_id) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
                  [agentId, userId, paymentId, commissionAmount, commissionRate, business_id]
                );

                console.log(`Recorded commission of ${commissionAmount} for agent ${agentId} on payment ${paymentId}`, commm.rows[0]);
            }
        }
      }
    }

    const loansToUpdate = await client.query('SELECT id, amount_paid, balance, next_payment_date, payment_frequency FROM ray_loans WHERE id = $1 AND customer_id = $2 AND business_id = $3', [loanId, userId, business_id]);

    if (loansToUpdate.rows.length > 0) {
        const loan = loansToUpdate.rows[0];
        const newAmountPaid = parseFloat(loan.amount_paid || 0) + parseFloat(amount);
        const newBalance = parseFloat(loan.balance) - parseFloat(amount);
        console.log({loan});
        const newStatus = newBalance <= 0 ? 'completed' : 'active';
        
        let newNextPaymentDate;

        if (isInitialPayment) {
            newNextPaymentDate = new Date();
        } else {
            if(!loan.next_payment_date || new Date(loan.next_payment_date) < new Date()) {
              newNextPaymentDate = new Date();
            } else {
              newNextPaymentDate = new Date(loan.next_payment_date);
            }
        }

        if (newStatus === 'active') {
            newNextPaymentDate.setDate(newNextPaymentDate.getDate() + tokenExpirationDays);
        } else {
            newNextPaymentDate = null;
        }

        await client.query(
            'UPDATE ray_loans SET amount_paid = $1, balance = $2, status = $3, next_payment_date = $4, updated_at = NOW() WHERE id = $5 AND business_id = $6',
            [newAmountPaid, newBalance, newStatus, newNextPaymentDate, loan.id, business_id]
        );
    }

    return token;
  } catch (error) {
    console.error('Error handling successful payment and token generation:', error);
    throw error;
  }
};

module.exports = {
  handleSuccessfulPayment,
};