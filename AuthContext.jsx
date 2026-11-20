import { useState } from "react";
import AuthContext from "./auth-context";


export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(
        localStorage.getItem("lg_demo_session")
      ) || null;
    } catch {
      return null;
    }
  });

  const login = (email, password) => {
    if (!email || !password) {
      return {
        success: false,
        message: "Enter your email and password.",
      };
    }

    const normalizedEmail = email.trim().toLowerCase();

    const registeredUsers = JSON.parse(
      localStorage.getItem("lg_demo_users") || "[]"
    );

    const isDemoAccount =
      normalizedEmail === "demo@ledgerguard.com";

    const registeredUser = registeredUsers.find(
      (item) => item.email === normalizedEmail
    );

    if (!isDemoAccount && !registeredUser) {
      return {
        success: false,
        message: "Account not found. Please register first.",
      };
    }

    const session = {
      email: normalizedEmail,
      name: registeredUser?.name || "Demo Administrator",
    };

    localStorage.setItem(
      "lg_demo_session",
      JSON.stringify(session)
    );

    setUser(session);

    return { success: true };
  };

  const register = (name, email) => {
    const normalizedEmail = email.trim().toLowerCase();

    const users = JSON.parse(
      localStorage.getItem("lg_demo_users") || "[]"
    );

    if (
      users.some((item) => item.email === normalizedEmail)
    ) {
      return {
        success: false,
        message: "This email is already registered.",
      };
    }

    const newUser = {
      name: name.trim(),
      email: normalizedEmail,
    };

    localStorage.setItem(
      "lg_demo_users",
      JSON.stringify([...users, newUser])
    );

    return { success: true };
  };

  const logout = () => {
    localStorage.removeItem("lg_demo_session");
    setUser(null);
  };

  return (
    <AuthContext.Provider
      value={{ user, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}
