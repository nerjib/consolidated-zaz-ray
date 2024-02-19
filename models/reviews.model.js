module.exports = (sequelize, Sequelize) => {
    const Review = sequelize.define("beaureviews", {
      userid: {
        type: Sequelize.INTEGER,
      },
      customername: {
        type: Sequelize.STRING,
      },
      productid: {
        type: Sequelize.INTEGER,
      },
      productname: {
        type: Sequelize.STRING,
      },
      review: {
        type: Sequelize.STRING,
      },    
      createdAt: {
        type: Sequelize.DATE,
      },
      updatedat: {
        type: Sequelize.DATE,
      }     
    });
    return Review;
  };