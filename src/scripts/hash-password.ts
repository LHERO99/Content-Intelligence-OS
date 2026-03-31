import bcrypt from "bcryptjs";

/**
 * Utility script to generate a bcrypt hash for a password.
 * Usage: npx tsx src/scripts/hash-password.ts <password>
 */

async function main() {
  const password = process.argv[2];

  if (!password) {
    console.error("Error: Please provide a password as an argument.");
    console.log("Usage: npx tsx src/scripts/hash-password.ts <password>");
    process.exit(1);
  }

  try {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    
    console.log("\n--- Password Hash Generated ---");
    console.log("Password:", "*".repeat(password.length));
    console.log("Hash:    ", hash);
    console.log("-------------------------------\n");
    console.log("Copy the hash above and paste it into the 'Password' field in Airtable.");
  } catch (error) {
    console.error("Error generating hash:", error);
    process.exit(1);
  }
}

main();
