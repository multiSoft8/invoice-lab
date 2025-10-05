import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  port: Number(process.env.PORT ?? 4000),
  uploadDir: process.env.UPLOAD_DIR ?? "../../data/invoices",
};
