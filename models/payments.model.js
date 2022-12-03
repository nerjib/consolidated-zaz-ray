module.exports = (sequelize, Sequelize) => {
    const PaymentModel = sequelize.define("nmspayments", {
      ref: {
        type: Sequelize.STRING,
        unique: true
      },
      ippis: {
        type: Sequelize.STRING,
      },
      legacyid: {
        type: Sequelize.STRING,
      },
      name: {
        type: Sequelize.STRING,
      },
      element: {
        type: Sequelize.STRING,
      },
      amount: {
        type: Sequelize.STRING,
      },
      period: {
        type: Sequelize.STRING,
      },
      command: {
        type: Sequelize.STRING,
      }
    });
    return PaymentModel;
  };