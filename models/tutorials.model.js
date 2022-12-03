module.exports = (sequelize, Sequelize) => {
    const Tutorial = sequelize.define("zazzauusers", {
      name: {
        type: Sequelize.STRING
      },
      ippis: {
        type: Sequelize.STRING,
        unique: true
      },
      phoneNumber: {
        type: Sequelize.STRING,
      },
      site: {
        type: Sequelize.STRING,
      },
      beacon: {
        type: Sequelize.STRING,
      },
      address: {
        type: Sequelize.STRING,
      }     
    });
    return Tutorial;
  };