module.exports = (sequelize, Sequelize) => {
    const Cart = sequelize.define("beucheckoutcart", {
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
      status: {
        type: Sequelize.STRING,
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
    return Cart;
  };