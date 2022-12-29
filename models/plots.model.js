module.exports = (sequelize, Sequelize) => {
    const Plots = sequelize.define("zazzauplots", {
      customerid: {
        type: Sequelize.STRING,
      },
      customername: {
        type: Sequelize.STRING,
      },
      plotno: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      status: {
        type: Sequelize.STRING,
      },
      phonenumber: {
        type: Sequelize.STRING,
      },
      shape: {
        type: Sequelize.STRING,
      },
      siteid: {
        type: Sequelize.INTEGER,
      },
      coords: {
        type: Sequelize.ARRAY(Sequelize.STRING)
      },
      block: {
        type: Sequelize.STRING,
        primaryKey: true,
      },
      location: {
        type: Sequelize.STRING,
        primaryKey: true,
      },    
      soldat: {
        type: Sequelize.DATE,
      }     
    });
    return Plots;
  };