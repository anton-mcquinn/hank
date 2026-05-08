import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/AuthContext";
import { Link } from "react-router-dom";

export function HomePage() {
  const { user, logout } = useAuth();

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Hank</h1>
          <p className="text-sm text-muted-foreground">
            Signed in as {user?.username}
          </p>
        </div>
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </header>

      <nav className="flex flex-col gap-2">
        <Link
          to="/customers"
          className="rounded-md border bg-card px-4 py-3 text-sm font-medium hover:bg-accent"
        >
          Customers
        </Link>
      </nav>
    </div>
  );
}
