module.exports = (sequelize, Sequelize) => {
    const Site = sequelize.define("sitor", {
        name: {
            type: Sequelize.STRING
          },
        
    });
    return Site;
  };