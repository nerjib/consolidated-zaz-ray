module.exports = (sequelize, Sequelize) => {
    const Wholesale = sequelize.define("beauwholesales", {
      customerid: {
        type: Sequelize.STRING,
      },
      customername: {
        type: Sequelize.STRING,
      },
      productid: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      productname: {
        type: Sequelize.STRING,
      },
      price: {
        type: Sequelize.STRING,
      },
      qty: {
        type: Sequelize.STRING,
      },
      address: {
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
      adminid: {
        type: Sequelize.INTEGER,
      },
      referenceid: {
        type: Sequelize.STRING,
        primaryKey: true,
      },    
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedat: {
        type: Sequelize.DATE,
      }     
    });
    return Wholesale;
  };