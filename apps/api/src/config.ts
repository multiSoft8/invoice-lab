import dotenv from "dotenv";
dotenv.config();

export const CONFIG = {
  port: Number(process.env.PORT ?? 4000),
  uploadDir: process.env.UPLOAD_DIR ?? "../../data/invoices",
  maxFileSize: Number(process.env.MAX_FILE_SIZE ?? 50 * 1024 * 1024), // 50MB default
  maxFiles: Number(process.env.MAX_FILES ?? 10),
};
