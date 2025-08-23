const { query } = require('../src/controllers/rayconnect/config/database'); // Adjust path as needed
const dotenv = require('dotenv');
dotenv.config(); // Load environment variables

async function updateOverdueLoans() {
  try {
    console.log('Starting overdue loan update job...');

    // Find loans that are active and whose next_payment_date has passed
    const overdueLoans = await query(
      `SELECT id, next_payment_date FROM ray_loans
       WHERE status = 'active' AND next_payment_date < CURRENT_DATE`
    );

    if (overdueLoans.rows.length === 0) {
      console.log('No active loans found to mark as overdue.');
      return;
    }

    console.log(`Found ${overdueLoans.rows.length} loans to mark as overdue.`);

    // Update status to 'overdue'
    const updateResult = await query(
      `UPDATE ray_loans SET status = 'overdue', updated_at = CURRENT_TIMESTAMP
       WHERE status = 'active' AND next_payment_date < CURRENT_DATE
       RETURNING id`
    );

    console.log(`Successfully updated ${updateResult.rows.length} loans to 'overdue'.`);
    updateResult.rows.forEach(loan => {
      console.log(`  - Loan ID: ${loan.id}`);
    });

  } catch (error) {
    console.error('Error updating overdue loans:', error.message);
  } finally {
    // Ensure the process exits after completion
    process.exit(0);
  }
}

updateOverdueLoans();