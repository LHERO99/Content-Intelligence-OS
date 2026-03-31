import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { updateUser } from "@/lib/airtable";
import bcrypt from "bcryptjs";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);

    if (!session?.user?.email || !session?.user?.id) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 });
    }

    const { newPassword } = await req.json();

    if (!newPassword || newPassword.length < 8) {
      return NextResponse.json(
        { error: "Das Passwort muss mindestens 8 Zeichen lang sein" },
        { status: 400 }
      );
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);

    const updatedUser = await updateUser(session.user.id, {
      Password: hashedPassword,
      Password_Changed: true,
    });

    if (!updatedUser) {
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren des Passworts in Airtable" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[API] Change password error:", error);
    return NextResponse.json(
      { error: "Ein interner Fehler ist aufgetreten" },
      { status: 500 }
    );
  }
}
