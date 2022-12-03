module.exports = (sequelize, Sequelize) => {
    const Plots = sequelize.define("zazzauplots", {
      plotno: {
        type: Sequelize.STRING
      },
      status: {
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
      customerid: {
        type: Sequelize.STRING,
      },
      soldat: {
        type: Sequelize.DATE,
      }     
    });
    return Plots;
  };