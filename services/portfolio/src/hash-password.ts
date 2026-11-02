import bcrypt from "bcryptjs";
const password = process.env.PORTFOLIO_ADMIN_PASSWORD;
if (!password || password.length < 12 || Buffer.byteLength(password) > 72)
  throw new Error(
    "Supply a 12-72 byte PORTFOLIO_ADMIN_PASSWORD securely in your own terminal",
  );
console.log(await bcrypt.hash(password, 12));
