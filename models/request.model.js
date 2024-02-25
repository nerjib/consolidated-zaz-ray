module.exports = (sequelize, Sequelize) => {
    const requests = sequelize.define("wholesellerrequests", {
      userid: {
        type: Sequelize.INTEGER,
      },
      customername: {
        type: Sequelize.STRING,
      },
      status: {
        type: Sequelize.STRING,
      },    
      createdat: {
        type: Sequelize.DATE,
      },
      updatedat: {
        type: Sequelize.DATE,
      }     
    });
    return requests;
  };