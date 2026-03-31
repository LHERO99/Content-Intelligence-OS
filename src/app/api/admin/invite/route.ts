import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { createUser, getUserByEmail } from "@/lib/airtable";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session || session.user.role !== "Admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { email, name, role } = await request.json();

    if (!email || !name || !role) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email);
    if (existingUser) {
      return NextResponse.json({ error: "User already exists" }, { status: 400 });
    }

    // Generate a temporary password
    const tempPassword = crypto.randomBytes(8).toString("hex");
    const hashedPassword = await bcrypt.hash(tempPassword, 10);

    const newUser = await createUser({
      Email: email,
      Name: name,
      Role: role,
      Password: hashedPassword,
    });

    if (!newUser) {
      return NextResponse.json({ error: "Failed to create user" }, { status: 500 });
    }

    // In a real app, we would send an email here.
    // For now, we return the invite link/temp password.
    const inviteLink = `${process.env.NEXTAUTH_URL}/auth/signin?email=${encodeURIComponent(email)}&temp=${tempPassword}`;

    return NextResponse.json({ 
      message: "User invited successfully", 
      inviteLink,
      tempPassword 
    });
  } catch (error) {
    console.error("[API] Error inviting user:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
