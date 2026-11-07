import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Check, Eye, EyeOff } from "lucide-react";
import { AuthLayout, FieldGroup } from "@/components/griv/AuthLayout";
import { setGriv } from "@/lib/griv-store";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Create your Griv account — Griv Finance" },
      { name: "description", content: "Get everything you need to run your business from one place: payments, payouts, invoices, inventory and more." },
      { property: "og:title", content: "Create your Griv account — Griv Finance" },
      { property: "og:description", content: "Everything you need to run your business, from one platform built for African businesses." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: SignUp,
});

function SignUp() {
  const navigate = useNavigate();
  const [f, setF] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "" });
  const [show, setShow] = useState(false);
  const valid = f.firstName && f.lastName && /\S+@\S+\.\S+/.test(f.email) && f.phone.length >= 10 && f.password.length >= 8;

  return (
    <AuthLayout
      topRight={
        <>
          Already on Griv?{" "}
          <Link to="/login" className="font-semibold text-primary hover:underline">Log in</Link>
        </>
      }
      aside={
        <>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">Everything you need to run your business.</h2>
          <ul className="mt-8 space-y-3 text-blackwood-foreground/80">
            {["Collect payments by transfer, card or link", "Pay suppliers and staff, one by one or in bulk", "Track sales, products and inventory", "See how your business is really doing"].map((t) => (
              <li key={t} className="flex items-center gap-3">
                <span className="grid h-5 w-5 place-items-center rounded-full bg-primary text-primary-foreground"><Check className="h-3 w-3" /></span>
                {t}
              </li>
            ))}
          </ul>
        </>
      }
    >
      <h1 className="text-3xl font-semibold tracking-tight">Let's get your business running.</h1>
      <p className="mt-2 text-muted-foreground">Create your Griv account and get everything you need to run your business from one place.</p>
      <form
        className="mt-8 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!valid) return;
          setGriv({ firstName: f.firstName, lastName: f.lastName, email: f.email, phone: f.phone });
          navigate({ to: "/verify" });
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="First name"><input className="field" value={f.firstName} onChange={(e) => setF({ ...f, firstName: e.target.value })} placeholder="Ada" maxLength={60} /></FieldGroup>
          <FieldGroup label="Last name"><input className="field" value={f.lastName} onChange={(e) => setF({ ...f, lastName: e.target.value })} placeholder="Okafor" maxLength={60} /></FieldGroup>
        </div>
        <FieldGroup label="Work email"><input type="email" className="field" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} placeholder="ada@novaretail.ng" maxLength={255} /></FieldGroup>
        <FieldGroup label="Phone number">
          <div className="flex gap-2">
            <span className="field flex w-24 shrink-0 items-center gap-1.5 text-sm">🇳🇬 +234</span>
            <input inputMode="numeric" className="field" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 11) })} placeholder="803 123 4567" />
          </div>
        </FieldGroup>
        <FieldGroup label="Password" hint="At least 8 characters.">
          <div className="relative">
            <input type={show ? "text" : "password"} className="field pr-11" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} maxLength={128} />
            <button type="button" onClick={() => setShow(!show)} className="absolute inset-y-0 right-0 px-3 text-muted-foreground" aria-label="Toggle password">
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </FieldGroup>
        <button disabled={!valid} className="btn btn-primary w-full">Create account</button>
        <p className="text-center text-xs text-muted-foreground">By continuing you agree to Griv's Terms and Privacy Policy.</p>
      </form>
    </AuthLayout>
  );
}
