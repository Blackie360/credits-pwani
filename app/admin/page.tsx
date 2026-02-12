import { cookies } from 'next/headers'
import Link from 'next/link'
import { getAdminCookieName, verifyAdminToken } from '@/lib/admin'
import { db } from '@/lib/db'
import { referralCodes, allowedEmails } from '@/lib/db/schema'
import { desc } from 'drizzle-orm'
import { adminLogin, adminLogout, uploadEmailsCsv, uploadCodesCsv } from './actions'
import { AdminLoginForm } from './admin-login-form'
import { CsvUpload } from './csv-upload'

async function Summary () {
  const codes = await db
    .select({
      id: referralCodes.id,
      claimedByEmail: referralCodes.claimedByEmail
    })
    .from(referralCodes)

  const emails = await db.select({ email: allowedEmails.email }).from(allowedEmails)

  const redeemed = codes.filter((r) => r.claimedByEmail != null)
  const available = codes.filter((r) => r.claimedByEmail == null)

  return (
    <div className="grid gap-4 sm:grid-cols-4">
      <div className="rounded-lg border border-zinc-600/60 bg-zinc-800/50 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Total codes</p>
        <p className="mt-1 text-2xl font-bold text-white">{codes.length}</p>
      </div>
      <div className="rounded-lg border border-zinc-600/60 bg-zinc-800/50 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Redeemed</p>
        <p className="mt-1 text-2xl font-bold text-orange-500">{redeemed.length}</p>
      </div>
      <div className="rounded-lg border border-zinc-600/60 bg-zinc-800/50 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Available</p>
        <p className="mt-1 text-2xl font-bold text-emerald-500">{available.length}</p>
      </div>
      <div className="rounded-lg border border-zinc-600/60 bg-zinc-800/50 p-4 text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-zinc-500">Allowed emails</p>
        <p className="mt-1 text-2xl font-bold text-blue-400">{emails.length}</p>
      </div>
    </div>
  )
}

async function CodesTable () {
  const codes = await db
    .select({
      id: referralCodes.id,
      code: referralCodes.code,
      url: referralCodes.url,
      claimedByEmail: referralCodes.claimedByEmail
    })
    .from(referralCodes)
    .orderBy(desc(referralCodes.id))

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-600/60 bg-zinc-800/50">
      <div className="border-b border-zinc-600/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-200">Referral Codes</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[420px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-600/60">
              <th className="px-4 py-3 font-semibold text-zinc-300">Code</th>
              <th className="px-4 py-3 font-semibold text-zinc-300">Status</th>
              <th className="px-4 py-3 font-semibold text-zinc-300">Redeemed by</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((row) => (
              <tr
                key={row.id}
                className="border-b border-zinc-700/50 last:border-0"
              >
                <td className="font-mono px-4 py-3 text-zinc-200">
                  {row.code}
                </td>
                <td className="px-4 py-3">
                  {row.claimedByEmail ? (
                    <span className="rounded bg-orange-500/20 px-2 py-0.5 text-orange-400">
                      Redeemed
                    </span>
                  ) : (
                    <span className="rounded bg-emerald-500/20 px-2 py-0.5 text-emerald-400">
                      Available
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-zinc-400">
                  {row.claimedByEmail ?? '—'}
                </td>
              </tr>
            ))}
            {codes.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-6 text-center text-zinc-500">
                  No codes yet. Upload a CSV to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

async function EmailsTable () {
  const emails = await db
    .select({
      email: allowedEmails.email,
      name: allowedEmails.name
    })
    .from(allowedEmails)

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-600/60 bg-zinc-800/50">
      <div className="border-b border-zinc-600/60 px-4 py-3">
        <h2 className="text-sm font-semibold text-zinc-200">Allowed Emails ({emails.length})</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[320px] text-left text-sm">
          <thead>
            <tr className="border-b border-zinc-600/60">
              <th className="px-4 py-3 font-semibold text-zinc-300">Email</th>
              <th className="px-4 py-3 font-semibold text-zinc-300">Name</th>
            </tr>
          </thead>
          <tbody>
            {emails.map((row) => (
              <tr
                key={row.email}
                className="border-b border-zinc-700/50 last:border-0"
              >
                <td className="px-4 py-3 text-zinc-200">{row.email}</td>
                <td className="px-4 py-3 text-zinc-400">{row.name ?? '—'}</td>
              </tr>
            ))}
            {emails.length === 0 && (
              <tr>
                <td colSpan={2} className="px-4 py-6 text-center text-zinc-500">
                  No allowed emails yet. Upload a CSV to get started.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default async function AdminPage () {
  const cookieStore = await cookies()
  const token = cookieStore.get(getAdminCookieName())?.value
  const isAdmin = verifyAdminToken(token)

  if (!isAdmin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#1a1a1a] px-4 py-16 font-sans text-white">
        <main className="w-full max-w-sm">
          <h1 className="mb-6 text-center text-xl font-bold text-zinc-100">
            Admin
          </h1>
          <AdminLoginForm action={adminLogin} />
          <p className="mt-6 text-center text-xs text-zinc-500">
            <Link href="/" className="underline hover:text-zinc-400">
              Back to redeem
            </Link>
          </p>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#1a1a1a] px-4 py-12 font-sans text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-zinc-100">
              Admin Dashboard
            </h1>
            <p className="mt-1 text-sm text-zinc-400">
              Manage codes, emails, and CSV uploads
            </p>
          </div>
          <form action={adminLogout}>
            <button
              type="submit"
              className="rounded-lg border border-zinc-600 bg-zinc-800 px-4 py-2 text-sm font-medium text-zinc-300 transition-colors hover:bg-zinc-700 hover:text-white"
            >
              Log out
            </button>
          </form>
        </header>

        <div className="space-y-8">
          <Summary />

          <div className="grid gap-4 sm:grid-cols-2">
            <CsvUpload
              action={uploadEmailsCsv}
              label="Upload Emails CSV"
              hint="CSV must have an &quot;email&quot; column. Optionally &quot;name&quot;, &quot;first_name&quot;, &quot;last_name&quot;."
            />
            <CsvUpload
              action={uploadCodesCsv}
              label="Upload Codes CSV"
              hint="CSV must have a &quot;code&quot; column. URLs are auto-generated."
            />
          </div>

          <CodesTable />

          <EmailsTable />
        </div>

        <p className="mt-8 text-center text-xs text-zinc-500">
          <Link href="/" className="underline hover:text-zinc-400">
            Back to redeem
          </Link>
        </p>
      </div>
    </div>
  )
}
