const { Router } = require("express");

const router = Router();

router.use("/health", require("./health"));
// Later tasks mount their routers here, for example:
router.use("/auth", require("./auth")); // B3
router.use("/me", require("./me")); // B4
router.use("/goals", require("./goals"));
module.exports = router;
