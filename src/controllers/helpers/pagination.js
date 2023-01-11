const getPagination = (page, size) => {
    const limit = size ? +size : 3;
    const offset = page ? page * limit : 0;
  
    return { limit, offset };
  };
  
  const getPagingData = (rdata, page, limit) => {
    const { count: totalItems, rows: data } = rdata;
    const currentPage = page ? +page : 0;
    const totalPages = Math.ceil(totalItems / limit);
    const status = true;
    const message = 'Successful'
    return { status, message, totalItems, data, totalPages, currentPage };
  };

  module.exports = {
    getPagination,
    getPagingData
  }