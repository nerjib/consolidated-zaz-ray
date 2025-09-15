const can = (permission, roles=[]) => {
  return (req, res, next) => {
    console.log('User role:', req.user.permissions, roles, roles.includes(req.user.role));
    const userPermissions = req.user?.permissions || [];
    if (roles.includes(req.user.role)) {
      next();
      return;
      // return res.status(403).json({ msg: 'Access denied: You do not have the required role.' });
    }
    if (!userPermissions.includes(permission)) {
      return res.status(403).json({ msg: 'Access Denied: You do not have the required permission.' });
    }
    
    next();
  };
};

module.exports = can;
