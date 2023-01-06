module.exports = (sequelize, Sequelize) => {
    const PaymentModel = sequelize.define("nmspayments", {
      ref: {
        type: Sequelize.INTEGER,
        autoIncrement: true,
        primaryKey: true
      },
      ippis: {
        type: Sequelize.STRING,
        primaryKey: true,
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
        primaryKey: true,
      },
      command: {
        type: Sequelize.STRING,
      }
    });
    return PaymentModel;
  };