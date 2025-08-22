const { query } = require('../config/database');
const { sendSMS } = require('./smsService');
const { generateBioliteCode } = require('./bioliteService');

const handleSuccessfulPayment = async (userId, amount, paymentId, loanId = null) => {
  try {
    let token = null;
    let tokenExpirationDays = 30; // Default to 30 days if no loan or specific calculation

    if (loanId) {
      const loanResult = await query('SELECT payment_amount_per_cycle, device_id, payment_frequency, payment_cycle_amount FROM ray_loans WHERE id = $1', [loanId]);
      if (loanResult.rows.length > 0) {
        const paymentAmountPerCycle = parseFloat(loanResult.rows[0].payment_amount_per_cycle);
        const deviceId = loanResult.rows[0].device_id;
        const payment_frequency = loanResult.rows[0].payment_frequency;
        const payment_cycle_amount = parseFloat(loanResult.rows[0].payment_cycle_amount);

        if (amount > payment_cycle_amount) {
          const extraAmount = amount - payment_cycle_amount;
          let days_in_cycle;
          switch (payment_frequency) {
            case 'daily':
              days_in_cycle = 1;
              break;
            case 'weekly':
              days_in_cycle = 7;
              break;
            default: // monthly
              days_in_cycle = 30;
              break;
          }
          tokenExpirationDays = Math.floor(days_in_cycle + (extraAmount / payment_cycle_amount) * days_in_cycle); // Calculate days for BioLite arg
        } else {
          switch (payment_frequency) {
            case 'daily':
              tokenExpirationDays = 1;
              break;
            case 'weekly':
              tokenExpirationDays = 7;
              break;
            default: // monthly
              tokenExpirationDays = 30;
              break;
          }
        }

        // Get device serial number for BioLite
        const deviceResult = await query('SELECT serial_number FROM ray_devices WHERE id = $1', [deviceId]);
        const serialNum = deviceResult.rows.length > 0 ? deviceResult.rows[0].serial_number : null;

        if (serialNum) {
          try {
            //278785910
            const bioliteResponse = await generateBioliteCode(serialNum, 'add_time', tokenExpirationDays);
            token = bioliteResponse.code; // Assuming the BioLite API returns the code in a 'code' field
            console.log(`Generated BioLite code for device ${serialNum}: ${token}`);
          } catch (bioliteError) {
            console.error('Failed to generate BioLite code, falling back to internal token:', bioliteError.message);
            // Fallback to internal token generation if BioLite API fails
            token = Math.floor(100000 + Math.random() * 900000).toString();
          }
        } else {
          console.warn(`Device serial number not found for device ID: ${deviceId}. Falling back to internal token.`);
          token = Math.floor(100000 + Math.random() * 900000).toString();
        }
      } else {
        console.warn(`Loan ${loanId} not found. Falling back to internal token.`);
        token = Math.floor(100000 + Math.random() * 900000).toString();
      }
    } else {
      // If no loanId, generate a simple internal token
      token = Math.floor(100000 + Math.random() * 900000).toString();
    }

    // Save token to database
    await query(
      'INSERT INTO ray_tokens (user_id, token, payment_id, expires_at) VALUES ($1, $2, $3, $4)',
      [userId, token, paymentId, new Date(Date.now() + tokenExpirationDays * 24 * 60 * 60 * 1000)]
    );

    // Get user's phone number (assuming it's stored in the ray_users table or can be fetched)
    const user = await query('SELECT phone_number FROM ray_users WHERE id = $1', [userId]);
    const userContact = user.rows[0] ? user.rows[0].phone_number : null;

    if (userContact) {
      const message = `Your PayGo activation code is: ${token}. Amount paid: ${amount}. Valid for ${tokenExpirationDays} days.`;
      // await sendSMS(userContact, message); // Uncomment this line to enable SMS sending
      console.log(`Activation code ${token} sent to user ${userId} via SMS.`);
    } else {
      console.warn(`Could not send activation code to user ${userId}: No phone number found.`);
    }

    // Commission calculation
    // Find devices assigned to this customer by an agent
    const assignedDevices = await query(
      'SELECT assigned_by FROM ray_devices WHERE assigned_to = $1 AND assigned_by IS NOT NULL',
      [userId]
    );
    console.log(`Assigned ray_devices for customer ${userId}:`, assignedDevices.rows[0]);

    if (assignedDevices.rows.length > 0) {
      const agentId = assignedDevices.rows[0].assigned_by;

      const agentResult = await query('SELECT commission_rate, super_agent_id, role FROM ray_users WHERE id = $1', [agentId]);
      console.log('agentResult', agentResult.rows[0])
      if (agentResult.rows.length > 0) {
        if ( agentResult.rows[0].role === 'agent') {
          console.log('<<<<<<<>>>>>>>>>>>>');
        let commissionRate = agentResult.rows[0].commission_rate;
        if (commissionRate === null || commissionRate == 0 ) {
          const generalRate = await query("SELECT setting_value FROM ray_settings WHERE setting_key = $1", ['general_agent_commission_rate']);
          commissionRate = parseFloat(generalRate.rows[0].setting_value);
        }

        const commissionAmount = (amount * commissionRate) / 100;
        console.log('commAmount', commissionAmount);
        // Super-agent commission calculation
        const superAgentId = agentResult.rows[0].super_agent_id;

        if (superAgentId) {
          const superAgentResult = await query('SELECT commission_rate FROM ray_users WHERE id = $1', [superAgentId]);

          if (superAgentResult.rows.length > 0) {
            let superAgentCommissionRate = superAgentResult.rows[0].commission_rate;
            if (superAgentCommissionRate === null || superAgentCommissionRate == 0) {
              const generalSuperRate = await query("SELECT setting_value FROM ray_settings WHERE setting_key = $1", ['general_super_agent_commission_rate']);
              superAgentCommissionRate = parseFloat(generalSuperRate.rows[0].setting_value);
            }

            const superAgentCommissionAmount = (commissionAmount * superAgentCommissionRate) / 100;

            const agentCommission = commissionAmount - superAgentCommissionAmount;

            const newCommission = await query(
              'INSERT INTO ray_commissions (agent_id, customer_id, payment_id, amount, commission_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING id',
              [agentId, userId, paymentId, agentCommission, commissionRate]
            );
            await query(
              'INSERT INTO ray_super_agent_commissions (super_agent_id, agent_id, original_commission_id, amount, commission_percentage) VALUES ($1, $2, $3, $4, $5)',
              [superAgentId, agentId, newCommission.rows[0].id, superAgentCommissionAmount, superAgentCommissionRate]
            );
            console.log(`Super-agent ${superAgentId} earned ${superAgentCommissionAmount} from agent ${agentId}.`);
          }
        } else {
          await query(
            'INSERT INTO ray_commissions (agent_id, customer_id, payment_id, amount, commission_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING id',
            [agentId, userId, paymentId, commissionAmount, commissionRate]
          );
        }
      } else if (agentResult.rows[0].role === 'super-agent') {
        console.log('>>>>>>>>>>>>');
        const SuperComRate = await query("SELECT setting_value FROM ray_settings WHERE setting_key = $1", ['general_agent_commission_rate']);
        superAgentComRate = parseFloat(SuperComRate.rows[0].setting_value);
        const sperComAmount = (amount * superAgentComRate) / 100;
        console.log('commAmount', sperComAmount);
        const sAgentCommission = (sperComAmount/100) * 100
        const aCommsission = sperComAmount - sAgentCommission;
        const newCommission = await query(
          'INSERT INTO ray_commissions (agent_id, customer_id, payment_id, amount, commission_percentage) VALUES ($1, $2, $3, $4, $5) RETURNING id',
          [agentId, userId, paymentId, aCommsission, 100]
        );
        await query(
          'INSERT INTO ray_super_agent_commissions (super_agent_id, agent_id, amount, commission_percentage, original_commission_id) VALUES ($1, $2, $3, $4, $5)',
          [agentId, agentId,  sAgentCommission, superAgentComRate, newCommission.rows[0].id]
        );
      }
      }
    }

    // Loan management: Update loans
    let loansToUpdate = [];
    if (loanId) {
      // If a specific loanId is provided, fetch only that loan
      const specificLoan = await query('SELECT id, customer_id, total_amount, amount_paid, balance, term_months, next_payment_date, payment_frequency, payment_amount_per_cycle, status FROM ray_loans WHERE id = $1 AND customer_id = $2', [loanId, userId]);
      if (specificLoan.rows.length > 0) {
        loansToUpdate.push(specificLoan.rows[0]);
      } else {
        console.warn(`Specific loan ${loanId} not found for customer ${userId}.`);
      }
    } else {
      // If no specific loanId, apply to active ray_loans (existing behavior)
      const activeLoans = await query(
        'SELECT id, customer_id, total_amount, amount_paid, balance, term_months, next_payment_date, payment_frequency, payment_amount_per_cycle, status FROM ray_loans WHERE customer_id = $1 AND status = active ORDER BY created_at ASC',
        [userId]
      );
      loansToUpdate = activeLoans.rows;
    }

    let remainingAmount = amount;

    for (const loan of loansToUpdate) {
      if (remainingAmount <= 0) break;

      const amountToApply = Math.min(remainingAmount, loan.balance);
      const newAmountPaid = parseFloat(loan.amount_paid) + amountToApply;
      const newBalance = parseFloat(loan.balance) - amountToApply;
      const newStatus = newBalance <= 0 ? 'completed' : 'active';
      let newNextPaymentDate = loan.next_payment_date;

      // Only advance next payment date if the loan is still active after this payment
      if (newStatus === 'active') {
        // Advance next payment date based on payment frequency
        newNextPaymentDate = new Date(loan.next_payment_date);
        switch (loan.payment_frequency) {
          case 'daily':
            newNextPaymentDate.setDate(newNextPaymentDate.getDate() + 1);
            break;
          case 'weekly':
            newNextPaymentDate.setDate(newNextPaymentDate.getDate() + 7);
            break;
          default: // monthly
            newNextPaymentDate.setMonth(newNextPaymentDate.getMonth() + 1);
            break;
        }
      }

      await query(
        'UPDATE ray_loans SET amount_paid = $1, balance = $2, status = $3, next_payment_date = $4, updated_at = $6 WHERE id = $5',
        [newAmountPaid, newBalance, newStatus, newNextPaymentDate, loan.id, new Date()]
      );
      console.log(`Loan ${loan.id} updated: Paid ${amountToApply}, New Balance ${newBalance}, Status ${newStatus}, Next Payment Date ${newNextPaymentDate}.`);

      remainingAmount -= amountToApply;
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
