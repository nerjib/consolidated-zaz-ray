const { query } = require('../config/database');
const { sendSMS } = require('./smsService');
const { sendPaymentDoneMessage } = require('./whatsappService');
const { generateBioliteCode } = require('./bioliteService');
const { getActivationCode } = require('./beebeeService');
const { generateToken, TokenType } = require('./openPayGoService');
const { getBusinessCredentials } = require('./utils');

const handleSuccessfulPayment = async (client, userId, amount, paymentId, loanId = null, business_id, isInitialPayment = false, full_amount) => {
  try {
    const credentials = await getBusinessCredentials(business_id);
    if (!credentials) {
      throw new Error(`Could not retrieve credentials for business ${business_id}`);
    }

    const businessResult = await query('SELECT name FROM businesses WHERE id = $1', [business_id]);
    const businessName = businessResult.rows[0] ? businessResult.rows[0].name : '';

    let token = null;
    let tokenExpirationDays = 30;
    let deviceId = null
    if (loanId) {
      const loanResult = await client.query('SELECT l.payment_amount_per_cycle, l.device_id, l.payment_frequency, l.payment_cycle_amount, dt.token_validity_days, l.balance FROM ray_loans l JOIN ray_devices d ON l.device_id = d.id JOIN ray_device_types dt ON d.device_type_id = dt.id WHERE l.id = $1 AND l.business_id = $2', [loanId, business_id]);
      if (loanResult.rows.length > 0) {
        const { device_id, payment_frequency, payment_cycle_amount, token_validity_days, balance } = loanResult.rows[0];
        deviceId = device_id;
        const newBalance = parseFloat(balance) - parseFloat(amount);

        const deviceResult = await client.query('SELECT d.serial_number, d.non_tokenised, dt.manufacturer, d.openpaygo_secret_key, d.openpaygo_token_count FROM ray_devices d JOIN ray_device_types dt on d.device_type_id = dt.id WHERE d.id = $1 AND d.business_id = $2', [device_id, business_id]);
        const serialNum = deviceResult.rows.length > 0 ? deviceResult.rows[0].serial_number : null;
        const manufacturer = deviceResult.rows.length > 0 ? deviceResult.rows[0].manufacturer : null;
        const isNonTokenised = deviceResult.rows.length > 0 ? deviceResult.rows[0].non_tokenised : false;
        const openpaygo_secret_key = deviceResult.rows.length > 0 ? deviceResult.rows[0].openpaygo_secret_key : null;
        const openpaygo_token_count = deviceResult.rows.length > 0 ? deviceResult.rows[0].openpaygo_token_count : 0;

        if (newBalance <= 0) {
            // Loan completed, generate permanent token
            tokenExpirationDays = null;
            if (!serialNum) throw new Error(`Could not find serial number for device associated with loan ${loanId}.`);

            if (manufacturer === 'biolite') {
                const bioliteResponse = await generateBioliteCode(serialNum, 'unlock', 0, credentials);
                if (!bioliteResponse || !bioliteResponse.codeStr) throw new Error(`BioLite service did not return a valid activation code for SN ${serialNum}.`);
                token = bioliteResponse.codeStr;
            } else if (manufacturer === 'beebeejump' && !isNonTokenised) {
                const beebeeResponse = await getActivationCode(serialNum, 'ForeverCode');
                if (beebeeResponse && beebeeResponse.data && beebeeResponse.data.activationCode) token = beebeeResponse.data.activationCode;
                else throw new Error(`BeeBeeJump service did not return a valid activation code for SN ${serialNum}.`);
            } else if (manufacturer === 'solarun') {
                if (!openpaygo_secret_key) throw new Error(`OpenPAYGO device ${serialNum} does not have a secret key.`);
                const { updatedCount, token: generatedToken } = generateToken(openpaygo_secret_key, 0, openpaygo_token_count, TokenType.DISABLE_PAYG);
                token = generatedToken;
                await client.query('UPDATE ray_devices SET openpaygo_token_count = $1 WHERE id = $2', [updatedCount, device_id]);
            } else {
                token = 'open';
            }

        } else {
            // Loan still active, generate temporary token
            if (isInitialPayment && token_validity_days) {
                tokenExpirationDays = token_validity_days;
            } else {
                if (amount >= payment_cycle_amount && payment_cycle_amount > 0) {
                    const extraAmount = amount - payment_cycle_amount;
                    let days_in_cycle = payment_frequency === 'daily' ? 1 : payment_frequency === 'weekly' ? 7 : 30;
                    tokenExpirationDays = Math.floor(days_in_cycle + (extraAmount / payment_cycle_amount) * days_in_cycle);
                } else {
                    tokenExpirationDays = payment_frequency === 'daily' ? 1 : payment_frequency === 'weekly' ? 7 : 30;
                }
            }

            if (!serialNum) throw new Error(`Could not find serial number for device associated with loan ${loanId}.`);

            if (manufacturer === 'biolite' && credentials.biolite_private_key) {
                const bioliteResponse = await generateBioliteCode(serialNum, 'add_time', tokenExpirationDays, credentials);
                if (!bioliteResponse || !bioliteResponse.codeStr) {
                    throw new Error(`BioLite service did not return a valid activation code for SN ${serialNum}.`);
                }
                token = bioliteResponse.codeStr;
            } else if (manufacturer === 'beebeejump' && !isNonTokenised) {
                const beebeeResponse = await getActivationCode(serialNum, `${tokenExpirationDays}Days`);
                if (beebeeResponse && beebeeResponse.data && beebeeResponse.data.activationCode) {
                    token = beebeeResponse.data.activationCode;
                } else {
                    throw new Error(`BeeBeeJump service did not return a valid activation code for SN ${serialNum}.`);
                }
            } else if (manufacturer === 'solarun') {
                if (!openpaygo_secret_key) {
                    throw new Error(`OpenPAYGO device ${serialNum} does not have a secret key.`);
                }
                const { updatedCount, token: generatedToken } = generateToken(openpaygo_secret_key, tokenExpirationDays, openpaygo_token_count, TokenType.COUNTER_SYNC);
                token = generatedToken;
                await client.query('UPDATE ray_devices SET openpaygo_token_count = $1 WHERE id = $2', [updatedCount, device_id]);
            } else if (manufacturer === 'beebeejump' && isNonTokenised) {
                token = Math.floor(100000 + Math.random() * 900000).toString();
            } else {
                throw new Error(`Token generation for unsupported manufacturer: '${manufacturer}'`);
            }
        }
      }
    }
    if (!token) {
        token = Math.floor(100000 + Math.random() * 900000).toString();
    }

    await client.query(
      'INSERT INTO ray_tokens (user_id, token, payment_id, expires_at, business_id) VALUES ($1, $2, $3, $4, $5)',
      [userId, token, paymentId, tokenExpirationDays ? new Date(Date.now() + tokenExpirationDays * 24 * 60 * 60 * 1000) : null, business_id]
    );

    const user = await client.query('SELECT username, name, phone_number FROM ray_users WHERE id = $1 AND business_id = $2', [userId, business_id]);
    const userContact = user.rows[0] ? user.rows[0].phone_number : null;
    const userName = user.rows[0] ? user.rows[0].name : null;
    console.log({userContact, userName});
    if (userContact && credentials.africastalking_api_key) {
      const message = `Your PayGo activation code is: ${token}. Amount paid: ${amount}. ${tokenExpirationDays ? `Valid for ${tokenExpirationDays} days.` : 'This is a permanent unlock code.'}`;
      await sendSMS(userContact, message, credentials);
      console.log(`Activation code ${token} sent to user ${userId} via SMS ${tokenExpirationDays ? `${tokenExpirationDays} days` : 'permanently'}.`);
    }

    if (userContact && userName) {
        try {
            await sendPaymentDoneMessage(userContact, userName, full_amount, deviceId, token, tokenExpirationDays, businessName);
        } catch (err) {
            console.error(`Error sending WhatsApp message for payment ${paymentId}:`, err);
        }
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

const generateDeviceTokenForReplacement = async (client, deviceId, businessId, loanId) => {
  try {
    const credentials = await getBusinessCredentials(businessId);
    if (!credentials) {
      throw new Error(`Could not retrieve credentials for business ${businessId}`);
    }

    // Fetch loan details to calculate remaining days
    const loanResult = await client.query(
      'SELECT next_payment_date, paused_at, status, customer_id FROM ray_loans WHERE id = $1 AND business_id = $2',
      [loanId, businessId]
    );
    if (loanResult.rows.length === 0) {
      throw new Error(`Loan ${loanId} not found.`);
    }
    const loan = loanResult.rows[0];
    const customerId = loan.customer_id;

    let remainingDays = 0;
    const now = new Date();

    if (loan.status === 'paused' && loan.paused_at) {
      const pausedAt = new Date(loan.paused_at);
      // Calculate days from paused_at to now, then add to next_payment_date
      // This logic needs to be consistent with how resume calculates next_payment_date
      // For simplicity, let's assume remaining days are calculated from the original next_payment_date
      // and adjusted by the paused duration.
      // However, the request states "count the remaining days from there" (paused_at)
      // which implies the token should be valid for the duration from paused_at to the original end of the loan period.
      // Let's re-evaluate this. The most straightforward interpretation is to generate a token
      // for the duration between the current date and the *adjusted* next_payment_date.

      // If the loan was paused, the next_payment_date would have been adjusted upon resume.
      // Since we are replacing a device on an *existing* loan, we should consider the current
      // next_payment_date of the loan.
      // The request "count the remaining days from there" (paused_at) is a bit ambiguous here.
      // I will assume we need to calculate the days from the current date to the loan's next_payment_date.
      // If the loan was paused, the next_payment_date would have been pushed forward.
      // So, we calculate remaining days from now to the current next_payment_date.

      if (new Date(loan.next_payment_date) > now) {
        remainingDays = Math.ceil((new Date(loan.next_payment_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // If next_payment_date is in the past, it means the loan is overdue or needs payment.
        // For replacement, we should probably give at least a minimal token, e.g., 1 day.
        remainingDays = 1;
      }

    } else if (loan.status === 'active' && loan.next_payment_date) {
      if (new Date(loan.next_payment_date) > now) {
        remainingDays = Math.ceil((new Date(loan.next_payment_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      } else {
        // If next_payment_date is in the past, it means the loan is overdue or needs payment.
        // For replacement, we should probably give at least a minimal token, e.g., 1 day.
        remainingDays = 1;
      }
    } else {
      // Loan has no next_payment_date or is completed/pending. Provide a default minimal token.
      remainingDays = 1;
    }

    // Ensure remainingDays is at least 1
    remainingDays = Math.max(1, remainingDays);

    // Fetch device details for token generation
    const deviceResult = await client.query(
      'SELECT d.serial_number, d.non_tokenised, dt.manufacturer, d.openpaygo_secret_key, d.openpaygo_token_count FROM ray_devices d JOIN ray_device_types dt on d.device_type_id = dt.id WHERE d.id = $1 AND d.business_id = $2',
      [deviceId, businessId]
    );
    if (deviceResult.rows.length === 0) {
      throw new Error(`Device ${deviceId} not found.`);
    }
    const device = deviceResult.rows[0];

    const serialNum = device.serial_number;
    const manufacturer = device.manufacturer;
    const isNonTokenised = device.non_tokenised;
    const openpaygo_secret_key = device.openpaygo_secret_key;
    let openpaygo_token_count = device.openpaygo_token_count;

    let token = null;

    if (serialNum) {
      if (manufacturer === 'biolite' && credentials.biolite_private_key) {
        const bioliteResponse = await generateBioliteCode(serialNum, 'add_time', remainingDays, credentials);
        if (!bioliteResponse || !bioliteResponse.codeStr) {
          throw new Error(`BioLite service did not return a valid activation code for SN ${serialNum}.`);
        }
        token = bioliteResponse.codeStr;
        console.log(`Generated BioLite code for device ${serialNum}: ${token}`);
      } else if (manufacturer === 'beebeejump' && !isNonTokenised) {
        const beebeeResponse = await getActivationCode(serialNum, `${remainingDays}Days`);
        if (beebeeResponse && beebeeResponse.data && beebeeResponse.data.activationCode) {
          token = beebeeResponse.data.activationCode;
          console.log(`Generated BeeBeeJump code for device ${serialNum} ${remainingDays} days: ${token}`);
        } else {
          throw new Error(`BeeBeeJump service did not return a valid activation code for SN ${serialNum}.`);
        }
      } else if (manufacturer === 'solarun') {
        if (!openpaygo_secret_key) {
          throw new Error(`OpenPAYGO device ${serialNum} does not have a secret key.`);
        }
        console.log({ openpaygo_secret_key, remainingDays, openpaygo_token_count });
        const { updatedCount, token: generatedToken } = generateToken(openpaygo_secret_key, remainingDays, openpaygo_token_count, TokenType.COUNTER_SYNC);
        token = generatedToken;
        openpaygo_token_count = updatedCount; // Update for later database write
        console.log(`Generated OpenPAYGO code for device ${serialNum}: ${token}`);
        // Update token count in ray_devices
        await client.query('UPDATE ray_devices SET openpaygo_token_count = $1 WHERE id = $2', [openpaygo_token_count, deviceId]);
      } else if (manufacturer === 'beebeejump' && isNonTokenised) {
        // For non-tokenised BeeBeeJump devices, generate a random 6-digit token
        token = Math.floor(100000 + Math.random() * 900000).toString();
        console.log(`Generated non-tokenised BeeBeeJump device token: ${token}`);
      } else {
        throw new Error(`Token generation for unsupported manufacturer: '${manufacturer}'`);
      }
    } else {
      throw new Error(`Could not find serial number for device ${deviceId}. Cannot generate token.`);
    }

    if (!token) {
      token = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Insert token record
    await client.query(
      'INSERT INTO ray_tokens (user_id, token, expires_at, business_id, device_id) VALUES ($1, $2, $3, $4, $5)',
      [customerId, token, new Date(now.getTime() + remainingDays * 24 * 60 * 60 * 1000), businessId, deviceId]
    );

    // Send SMS (optional, depending on whether we want to send SMS for replacement tokens)
    const user = await client.query('SELECT phone_number FROM ray_users WHERE id = $1 AND business_id = $2', [customerId, businessId]);
    const userContact = user.rows[0] ? user.rows[0].phone_number : null;

    if (userContact && credentials.africastalking_api_key) {
      const message = `Your new device activation code is: ${token}. Valid for ${remainingDays} days.`;
      await sendSMS(userContact, message, credentials);
      console.log(`Activation code ${token} sent to user ${customerId} via SMS for replacement.`);
    }

    return token;

  } catch (error) {
    console.error('Error generating device token for replacement:', error);
    throw error;
  }
};

module.exports = {
  handleSuccessfulPayment,
  generateDeviceTokenForReplacement,
};