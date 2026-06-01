// db/setup.js — Run once to create database and all tables
const mysql = require('mysql2/promise');
require('dotenv').config();

const SQL_SCHEMA = `
-- =====================================================
-- GovBill Pro — MySQL Database Schema
-- =====================================================

CREATE DATABASE IF NOT EXISTS \`govbill_pro\` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE \`govbill_pro\`;

-- USERS TABLE
CREATE TABLE IF NOT EXISTS \`users\` (
  \`id\`           VARCHAR(36)   NOT NULL PRIMARY KEY,
  \`full_name\`    VARCHAR(255)  NOT NULL,
  \`email\`        VARCHAR(255)  NOT NULL UNIQUE,
  \`password_hash\` VARCHAR(255) NOT NULL,
  \`created_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- COMPANIES TABLE (Seller Profiles)
CREATE TABLE IF NOT EXISTS \`companies\` (
  \`id\`           VARCHAR(36)   NOT NULL PRIMARY KEY,
  \`user_id\`      VARCHAR(36)   NOT NULL,
  \`name\`         VARCHAR(255)  NOT NULL,
  \`address\`      TEXT          NOT NULL,
  \`gstin\`        VARCHAR(20)   DEFAULT NULL,
  \`pan\`          VARCHAR(15)   DEFAULT NULL,
  \`phone\`        VARCHAR(50)   DEFAULT NULL,
  \`email\`        VARCHAR(255)  DEFAULT NULL,
  \`is_default\`   TINYINT(1)   NOT NULL DEFAULT 0,
  \`created_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`   DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX \`idx_companies_user_id\` (\`user_id\`),
  CONSTRAINT \`fk_companies_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- CLIENTS TABLE (Government Departments / Buyers)
CREATE TABLE IF NOT EXISTS \`clients\` (
  \`id\`             VARCHAR(36)   NOT NULL PRIMARY KEY,
  \`user_id\`        VARCHAR(36)   NOT NULL,
  \`name\`           VARCHAR(255)  NOT NULL,
  \`address\`        TEXT          DEFAULT NULL,
  \`gstin\`          VARCHAR(20)   DEFAULT NULL,
  \`contact_person\` VARCHAR(255)  DEFAULT NULL,
  \`email\`          VARCHAR(255)  DEFAULT NULL,
  \`phone\`          VARCHAR(50)   DEFAULT NULL,
  \`created_at\`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`     DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX \`idx_clients_user_id\` (\`user_id\`),
  CONSTRAINT \`fk_clients_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- INVOICES TABLE
CREATE TABLE IF NOT EXISTS \`invoices\` (
  \`id\`                   VARCHAR(36)    NOT NULL PRIMARY KEY,
  \`user_id\`              VARCHAR(36)    NOT NULL,
  \`company_id\`           VARCHAR(36)    DEFAULT NULL,
  \`client_id\`            VARCHAR(36)    DEFAULT NULL,
  \`invoice_no\`           VARCHAR(50)    NOT NULL,
  \`invoice_date\`         DATE           NOT NULL,
  \`subject\`              TEXT           DEFAULT NULL,
  \`bill_to_name\`         VARCHAR(255)   NOT NULL,
  \`bill_to_address\`      TEXT           DEFAULT NULL,
  \`bill_to_gstin\`        VARCHAR(20)    DEFAULT NULL,
  \`bill_to_place_of_supply\` VARCHAR(100) DEFAULT 'Maharashtra',
  \`ship_to_name\`         VARCHAR(255)   DEFAULT NULL,
  \`ship_to_address\`      TEXT           DEFAULT NULL,
  \`total_taxable_value\`  DECIMAL(14,2)  NOT NULL DEFAULT 0,
  \`total_tax_amount\`     DECIMAL(14,2)  NOT NULL DEFAULT 0,
  \`total_amount\`         DECIMAL(14,2)  NOT NULL DEFAULT 0,
  \`amount_in_words\`      TEXT           DEFAULT NULL,
  \`hide_zero_tax\`        TINYINT(1)    NOT NULL DEFAULT 1,
  \`status\`               ENUM('draft','sent','paid','cancelled') NOT NULL DEFAULT 'sent',
  \`pdf_url\`              VARCHAR(500)   DEFAULT NULL,
  \`created_at\`           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  \`updated_at\`           DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX \`idx_invoices_user_id\` (\`user_id\`),
  INDEX \`idx_invoices_client_id\` (\`client_id\`),
  INDEX \`idx_invoices_status\` (\`status\`),
  INDEX \`idx_invoices_date\` (\`invoice_date\`),
  CONSTRAINT \`fk_invoices_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
  CONSTRAINT \`fk_invoices_company\` FOREIGN KEY (\`company_id\`) REFERENCES \`companies\` (\`id\`) ON DELETE SET NULL,
  CONSTRAINT \`fk_invoices_client\` FOREIGN KEY (\`client_id\`) REFERENCES \`clients\` (\`id\`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- INVOICE ITEMS TABLE
CREATE TABLE IF NOT EXISTS \`invoice_items\` (
  \`id\`           VARCHAR(36)    NOT NULL PRIMARY KEY,
  \`invoice_id\`   VARCHAR(36)    NOT NULL,
  \`sort_order\`   INT            NOT NULL DEFAULT 0,
  \`hsn\`          VARCHAR(20)    DEFAULT '-',
  \`description\`  TEXT           NOT NULL,
  \`qty\`          DECIMAL(10,3)  NOT NULL DEFAULT 0,
  \`unit\`         VARCHAR(20)    NOT NULL DEFAULT 'PCS',
  \`rate\`         DECIMAL(12,2)  NOT NULL DEFAULT 0,
  \`tax_rate\`     DECIMAL(5,2)   NOT NULL DEFAULT 0,
  \`tax_amount\`   DECIMAL(12,2)  NOT NULL DEFAULT 0,
  \`amount\`       DECIMAL(12,2)  NOT NULL DEFAULT 0,
  \`created_at\`   DATETIME       NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX \`idx_invoice_items_invoice_id\` (\`invoice_id\`),
  CONSTRAINT \`fk_items_invoice\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
`;

async function setupDatabase() {
  let conn;
  try {
    // Connect without specifying a database first
    conn = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT) || 3306,
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      multipleStatements: true,
    });

    console.log('🔌 Connected to MySQL server');
    console.log('⚙️  Running database setup...\n');

    const statements = SQL_SCHEMA
      .split('\n')
      .map(line => line.trim())
      .filter(line => !line.startsWith('--') && !line.startsWith('#'))
      .join('\n')
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    for (const stmt of statements) {
      try {
        await conn.query(stmt + ';');
        const firstWord = stmt.split(' ')[0].toUpperCase();
        if (firstWord === 'CREATE') {
          const match = stmt.match(/TABLE IF NOT EXISTS `(\w+)`/i) || 
                        stmt.match(/DATABASE IF NOT EXISTS `(\w+)`/i);
          if (match) console.log(`  ✅ ${match[1]}`);
        } else if (firstWord === 'USE') {
          console.log(`  📂 Using database: govbill_pro`);
        }
      } catch (err) {
        if (!err.message.includes('already exists')) {
          console.warn(`  ⚠️  Warning on statement: ${err.message}`);
        }
      }
    }

    console.log('\n✅ Database setup complete!');
    console.log('📋 Tables created: users, companies, clients, invoices, invoice_items');
    console.log('\n🚀 You can now start the backend server with: npm run dev\n');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('   Check your DB_USER and DB_PASSWORD in backend/.env');
    }
    process.exit(1);
  } finally {
    if (conn) await conn.end();
  }
}

setupDatabase();
