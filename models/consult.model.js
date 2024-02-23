module.exports = (sequelize, Sequelize) => {
    const Consult = sequelize.define("beauconsults", {
      customerid: {
        type: Sequelize.STRING,
      },
      customername: {
        type: Sequelize.STRING,
      },
      price: {
        type: Sequelize.STRING,
      },
      paymentref: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.STRING,
      },
      paymentstatus: {
        type: Sequelize.STRING,
      },
      paymentdate: {
        type: Sequelize.DATE,
      },
      updatedat: {
        type: Sequelize.DATE,
      }     
    });
    return Consult;
  };