const { query } = require('../config/database');
const { sendSMS } = require('./smsService');
const { generateBioliteCode } = require('./bioliteService');
const { getActivationCode } = require('./beebeeService');
const { generateToken, TokenType } = require('./openPayGoService');
const { getBusinessCredentials } = require('./utils');

const handleOnetimePayment = async (client, { customer_id, device_id, business_id, amount, payment_id, onetime_commission_rate, agent_id }) => {
  try {
    const credentials = await getBusinessCredentials(business_id);
    if (!credentials) {
      throw new Error(`Could not retrieve credentials for business ${business_id}`);
    }

    const deviceResult = await client.query(
        'SELECT d.serial_number, d.non_tokenised, dt.manufacturer, d.openpaygo_secret_key, d.openpaygo_token_count, d.id as deviceId, d.first_time_commission_paid FROM ray_devices d JOIN ray_device_types dt on d.device_type_id = dt.id WHERE d.id = $1 AND d.business_id = $2',
        [device_id, business_id]
    );
    if (deviceResult.rows.length === 0) {
        throw new Error('Device not found');
    }
    const device = deviceResult.rows[0];
    const { serial_number: serialNum, manufacturer, openpaygo_secret_key, openpaygo_token_count, deviceId, first_time_commission_paid } = device;
    const isNonTokenised = deviceResult.rows.length > 0 ? deviceResult.rows[0].non_tokenised : false;

    let token;
    if (manufacturer === 'beebeejump' && !isNonTokenised) {
        const beebeeResponse = await getActivationCode(serialNum, 'ForeverCode');
        if (beebeeResponse && beebeeResponse.data && beebeeResponse.data.activationCode) {
            token = beebeeResponse.data.activationCode;
        } else {
            throw new Error(`BeeBeeJump service did not return a valid activation code for SN ${serialNum}.`);
        }
    } else if (manufacturer === 'biolite') {
        const bioliteResponse = await generateBioliteCode(serialNum, 'unlock', 0, credentials);
        if (bioliteResponse && bioliteResponse.codeStr) {
            token = bioliteResponse.codeStr;
        } else {
            throw new Error(`BioLite service did not return a valid activation code for SN ${serialNum}.`);
        }
    } else if (manufacturer === 'beebeejump' && isNonTokenised) {
    token = Math.floor(100000 + Math.random() * 900000).toString();
    }      else if (manufacturer === 'solarun') {
        const { updatedCount, token: generatedToken } = generateToken(openpaygo_secret_key, 0, openpaygo_token_count, TokenType.DISABLE_PAYG);
        token = generatedToken;
        await client.query('UPDATE ray_devices SET openpaygo_token_count = $1 WHERE id = $2', [updatedCount, deviceId]);
    } else {
        token = 'open';
    }

    await client.query(
      'INSERT INTO ray_tokens (user_id, token, payment_id, expires_at, business_id) VALUES ($1, $2, $3, $4, $5)',
      [customer_id, token, payment_id, null, business_id]
    );

    const user = await client.query('SELECT phone_number FROM ray_users WHERE id = $1 AND business_id = $2', [customer_id, business_id]);
    const userContact = user.rows[0] ? user.rows[0].phone_number : null;

    if (userContact && credentials.africastalking_api_key) {
      const message = `Your PayGo activation code is: ${token}. Amount paid: ${amount}. This is a permanent unlock code.`;
      await sendSMS(userContact, message, credentials);
    }

    // Commission logic
    const assignedDevices = await client.query(
      'SELECT assigned_by FROM ray_devices WHERE id = $1 AND assigned_by IS NOT NULL AND business_id = $2',
      [deviceId, business_id]
    );
    console.log({onetime_commission_rate}, 1)

    // if (assignedDevices.rows.length > 0) {
      const agentId = agent_id;
      
      if (onetime_commission_rate && onetime_commission_rate > 0) {
          const commissionAmount = (amount * onetime_commission_rate) / 100;
          console.log({onetime_commission_rate}, 2)
          if (commissionAmount > 0) {
              const agentResult = await client.query('SELECT super_agent_id FROM ray_users WHERE id = $1', [agentId]);
              const superAgentId = agentResult.rows.length > 0 ? agentResult.rows[0].super_agent_id : null;
              console.log({onetime_commission_rate}, 3)

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
                            [agentId, customer_id, payment_id, agentCommission, onetime_commission_rate, business_id]
                          );
                          await client.query(
                            'INSERT INTO ray_super_agent_commissions (super_agent_id, agent_id, original_commission_id, amount, commission_percentage, business_id) VALUES ($1, $2, $3, $4, $5, $6)',
                            [superAgentId, agentId, newCommission.rows[0].id, superAgentCommissionAmount, superAgentCommissionRate, business_id]
                          );
                      }
                  }
              } else {
                console.log({onetime_commission_rate}, 4)

                  await client.query(
                    'INSERT INTO ray_commissions (agent_id, customer_id, payment_id, amount, commission_percentage, business_id) VALUES ($1, $2, $3, $4, $5, $6)',
                    [agentId, customer_id, payment_id, commissionAmount, onetime_commission_rate, business_id]
                  );
              }
          }
          console.log({onetime_commission_rate}, 5)

          await client.query(
            'UPDATE ray_devices SET first_time_commission_paid = TRUE WHERE id = $1 AND business_id = $2',
            [device_id, business_id]
          );

      } else {
          const agentResult = await client.query('SELECT commission_rate, super_agent_id, role FROM ray_users WHERE id = $1 AND business_id = $2', [agentId, business_id]);

          if (agentResult.rows.length > 0) {
            const agent = agentResult.rows[0];
            let commissionAmount = 0;
            let commissionRate = 0;

            const firstTimeCommissionSetting = await client.query(
              'SELECT commission_amount FROM first_time_commission_settings WHERE business_id = $1',
              [business_id]
            );
            const fixedFirstTimeCommission = firstTimeCommissionSetting.rows.length > 0
              ? parseFloat(firstTimeCommissionSetting.rows[0].commission_amount)
              : 0;

            if (!first_time_commission_paid && fixedFirstTimeCommission > 0) {
              commissionAmount = fixedFirstTimeCommission;
              await client.query(
                'UPDATE ray_devices SET first_time_commission_paid = TRUE WHERE id = $1 AND business_id = $2',
                [deviceId, business_id]
              );
            } else {
              await client.query(
                'UPDATE ray_devices SET first_time_commission_paid = TRUE WHERE id = $1 AND business_id = $2',
                [deviceId, business_id]
              );
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
                              [agentId, customer_id, payment_id, agentCommission, commissionRate, business_id]
                            );
                            await client.query(
                              'INSERT INTO ray_super_agent_commissions (super_agent_id, agent_id, original_commission_id, amount, commission_percentage, business_id) VALUES ($1, $2, $3, $4, $5, $6)',
                              [superAgentId, agentId, newCommission.rows[0].id, superAgentCommissionAmount, superAgentCommissionRate, business_id]
                            );
                        }
                    }
                } else {
                    await client.query(
                      'INSERT INTO ray_commissions (agent_id, customer_id, payment_id, amount, commission_percentage, business_id) VALUES ($1, $2, $3, $4, $5, $6)',
                      [agentId, customer_id, payment_id, commissionAmount, commissionRate, business_id]
                    );
                }
            }
          }
        }
    // }

    return token;
  } catch (error) {
    console.error('Error handling onetime payment:', error);
    throw error;
  }
};

module.exports = { handleOnetimePayment };
