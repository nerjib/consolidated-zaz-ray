module.exports = (sequelize, Sequelize) => {
    const RefundModel = sequelize.define("refunds", {
      id: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
      },
      payment_ippis: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
      },
      payment_period: {
        type: Sequelize.STRING,
        allowNull: false,
        primaryKey: true,
      },
      amount: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      command: {
        type: Sequelize.STRING,
      },
      name: {
        type: Sequelize.STRING,
      },
      element: {
        type: Sequelize.STRING,
      },
      reason: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.STRING,
        defaultValue: 'processed'
      }
    });
    return RefundModel;
  };
