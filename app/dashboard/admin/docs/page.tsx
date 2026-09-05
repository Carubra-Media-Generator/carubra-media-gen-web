"use client"

import { useState } from "react"
import { useLanguage } from "@/contexts/language-context"
import { Lock, Info, Copy, Printer } from "lucide-react"

type Tab = 'db' | 'fitur' | 'api' | 'sso'

export default function DocsDevPage() {
  const { t } = useLanguage()
  const [pin, setPin] = useState("")
  const [isVerified, setIsVerified] = useState(false)
  const [error, setError] = useState(false)
  const [activeTab, setActiveTab] = useState<Tab>('db')

  const handleVerify = (e: React.FormEvent) => {
    e.preventDefault()
    if (pin === "uterocarubra123") {
      setIsVerified(true)
      setError(false)
    } else {
      setError(true)
    }
  }

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text)
  }

  if (!isVerified) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
        <div className="bg-blue-50 text-blue-800 p-4 rounded-xl flex items-start gap-3 max-w-md border border-blue-100 shadow-sm">
          <Info className="w-5 h-5 mt-0.5 flex-shrink-0" />
          <div className="text-sm leading-relaxed">
            <p>{t("adminDocs.pinInstruction")}</p>
            <p className="mt-2">{t("adminDocs.pinHint", { pin: "uterocarubra123" })}</p>
          </div>
        </div>

        <div className="w-full max-w-md bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-6 text-center border-b bg-slate-50/50">
            <div className="mx-auto bg-blue-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
              <Lock className="w-6 h-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900">{t("adminDocs.title")}</h2>
            <p className="text-sm text-slate-500 mt-1">{t("adminDocs.enterPin")}</p>
          </div>
          <div className="p-6">
            <form onSubmit={handleVerify} className="space-y-4">
              <div className="space-y-2">
                <input
                  type="password"
                  placeholder={t("adminDocs.pinPlaceholder")}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className={`flex h-10 w-full rounded-md border bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent ${error ? 'border-red-500 focus:ring-red-500' : 'border-slate-300'}`}
                />
                {error && <p className="text-sm text-red-500">{t("adminDocs.wrongPin")}</p>}
              </div>
              <button 
                type="submit" 
                className="w-full bg-blue-600 text-white hover:bg-blue-700 h-10 px-4 py-2 rounded-md text-sm font-medium transition-colors"
              >
                {t("adminDocs.openDocs")}
              </button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  const CodeBlock = ({ title, code }: { title: string, code: string }) => (
    <div className="rounded-xl border border-slate-200 overflow-hidden my-6 bg-slate-50">
       <div className="flex items-center justify-between px-4 py-2 bg-slate-100 border-b border-slate-200">
         <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</span>
         <button onClick={() => handleCopy(code)} className="text-xs font-medium text-slate-600 border px-2 py-1.5 rounded-md bg-white hover:bg-slate-50 flex items-center gap-1.5 transition-colors shadow-sm">
           <Copy className="w-3 h-3" /> {t("adminDocs.copy")}
         </button>
       </div>
       <pre className="p-5 text-sm font-mono overflow-x-auto text-slate-800 leading-relaxed">{code}</pre>
    </div>
  )

  const NavTab = ({ id, label }: { id: Tab, label: string }) => (
    <button 
      onClick={() => setActiveTab(id)}
      className={`py-4 px-1 text-sm font-medium transition-colors border-b-2 whitespace-nowrap ${
        activeTab === id 
        ? 'text-blue-600 border-blue-600' 
        : 'text-slate-500 border-transparent hover:text-slate-900 hover:border-slate-300'
      }`}
    >
      {label}
    </button>
  )

  return (
    <div className="min-h-screen bg-white text-slate-900 -m-4 sm:-m-8">
      {/* Topbar */}
      <nav className="border-b sticky top-0 bg-white/95 backdrop-blur-sm z-10 px-4 sm:px-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4 overflow-x-auto no-scrollbar">
          <div className="flex gap-6">
            <NavTab id="db" label={t("adminDocs.tabDb")} />
            <NavTab id="fitur" label={t("adminDocs.tabFitur")} />
            <NavTab id="api" label={t("adminDocs.tabApi")} />
            <NavTab id="sso" label={t("adminDocs.tabSso")} />
          </div>
          <button onClick={() => window.print()} className="hidden md:flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Printer className="w-4 h-4" /> {t("adminDocs.printSave")}
          </button>
        </div>
      </nav>

      <main className="max-w-5xl mx-auto py-10 px-4 sm:px-8">
        
        {/* Banner */}
        <div className="bg-blue-50 border border-blue-100 text-blue-900 p-5 rounded-xl text-sm leading-relaxed mb-10 shadow-sm">
          {t("adminDocs.banner")}
        </div>

        {/* Tab Content: Database */}
        {activeTab === 'db' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-bold mb-6 border-b border-slate-200 pb-3">{t("adminDocs.tableSchemas")}</h2>
            <p className="text-slate-600 mb-6">{t("adminDocs.tableSchemasDesc")}</p>
            
            <div className="rounded-xl border border-slate-200 overflow-hidden my-6 shadow-sm">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                   <tr>
                     <th className="px-5 py-3.5 font-semibold">{t("adminDocs.tableName")}</th>
                     <th className="px-5 py-3.5 font-semibold">{t("adminDocs.tableDesc")}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">ai_usage_logs</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.aiUsageLogs")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">api_error_logs</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.apiErrorLogs")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">content_analysis</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.contentAnalysis")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">generated_contents</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.generatedContents")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">image_history</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.imageHistory")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">images</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.images")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">members</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.members")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">membership_packages</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.membershipPackages")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">scheduled_posts</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.scheduledPosts")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">social_connects</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.socialConnects")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">transaction_history</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.transactionHistory")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">transactions</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.transactions")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">user_activity_logs</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.userActivityLogs")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">user_profile_summary</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.userProfileSummary")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">users</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.usersTable")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">video_history</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.videoHistory")}</td></tr>
                    <tr className="hover:bg-slate-50/50"><td className="px-5 py-4 font-mono font-medium text-blue-600">videos</td><td className="px-5 py-4 text-slate-600">{t("adminDocs.videosTable")}</td></tr>
                 </tbody>
               </table>
            </div>

            <h2 className="text-2xl font-bold mb-6 mt-12 border-b border-slate-200 pb-3">{t("adminDocs.functionsTriggers")}</h2>
            <p className="text-slate-600 mb-6">{t("adminDocs.functionsDesc")}</p>

            <div className="rounded-xl border border-slate-200 overflow-hidden my-6">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                   <tr>
                     <th className="px-5 py-3.5 font-semibold">{t("adminDocs.triggerName")}</th>
                     <th className="px-5 py-3.5 font-semibold">{t("adminDocs.triggerEvent")}</th>
                     <th className="px-5 py-3.5 font-semibold">{t("adminDocs.triggerResult")}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <span className="font-mono font-medium text-blue-600 block">set_invoice_number</span>
                        <span className="text-xs text-slate-400">Trigger: trigger_set_invoice_number</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-xs">BEFORE INSERT ON<br/>transactions</td>
                      <td className="px-5 py-4 text-slate-600">{t("adminDocs.triggerSetInvoice")}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <span className="font-mono font-medium text-blue-600 block">set_membership_order</span>
                        <span className="text-xs text-slate-400">Trigger: trigger_set_membership_order</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-xs">BEFORE INSERT ON<br/>users</td>
                      <td className="px-5 py-4 text-slate-600">{t("adminDocs.triggerSetMembership")}</td>
                    </tr>
                    <tr className="hover:bg-slate-50/50">
                      <td className="px-5 py-4">
                        <span className="font-mono font-medium text-blue-600 block">update_updated_at</span>
                        <span className="text-xs text-slate-400">Trigger: trigger_*_updated_at</span>
                      </td>
                      <td className="px-5 py-4 text-slate-600 font-mono text-xs">BEFORE UPDATE ON<br/>users, videos, images,<br/>transactions, dll</td>
                      <td className="px-5 py-4 text-slate-600">{t("adminDocs.triggerUpdateTimestamps")}</td>
                    </tr>
                 </tbody>
               </table>
            </div>
          </div>
        )}

        {/* Tab Content: Arsitektur Fitur */}
        {activeTab === 'fitur' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-bold mb-6 border-b border-slate-200 pb-3">{t("adminDocs.userFeatureTitle")}</h2>
            <p className="text-slate-600 mb-6">{t("adminDocs.userFeatureDesc")}</p>

            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold mb-4">1</div>
                <h3 className="font-bold text-slate-900 mb-2">{t("adminDocs.featureAiGenerator")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t("adminDocs.featureAiGeneratorDesc")}</p>
              </div>
              <div className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold mb-4">2</div>
                <h3 className="font-bold text-slate-900 mb-2">{t("adminDocs.featureSocialConnect")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t("adminDocs.featureSocialConnectDesc")}</p>
              </div>
              <div className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold mb-4">3</div>
                <h3 className="font-bold text-slate-900 mb-2">{t("adminDocs.featureCoinPurchase")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t("adminDocs.featureCoinPurchaseDesc")}</p>
              </div>
              <div className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition-shadow">
                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center text-blue-600 font-bold mb-4">4</div>
                <h3 className="font-bold text-slate-900 mb-2">{t("adminDocs.featureAnalytics")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t("adminDocs.featureAnalyticsDesc")}</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold mb-6 mt-16 border-b border-slate-200 pb-3">{t("adminDocs.adminFeatureTitle")}</h2>
            <div className="grid gap-6 md:grid-cols-2">
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-2">{t("adminDocs.featureUserManagement")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t("adminDocs.featureUserManagementDesc")}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6">
                <h3 className="font-bold text-slate-900 mb-2">{t("adminDocs.featurePricing")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t("adminDocs.featurePricingDesc")}</p>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-6 md:col-span-2">
                <h3 className="font-bold text-slate-900 mb-2">{t("adminDocs.featureMonitoring")}</h3>
                <p className="text-sm text-slate-600 leading-relaxed">{t("adminDocs.featureMonitoringDesc")}</p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Content: API */}
        {activeTab === 'api' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-bold mb-6 border-b border-slate-200 pb-3">{t("adminDocs.apiEndpoints")}</h2>
            <p className="text-slate-600 mb-6">{t("adminDocs.apiEndpointsDesc")}</p>

            <div className="rounded-xl border border-slate-200 overflow-hidden my-6 shadow-sm">
               <table className="w-full text-sm text-left">
                 <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                   <tr>
                     <th className="px-5 py-3.5 font-semibold w-1/3">{t("adminDocs.endpoint")}</th>
                     <th className="px-5 py-3.5 font-semibold w-24">{t("adminDocs.method")}</th>
                     <th className="px-5 py-3.5 font-semibold">{t("adminDocs.description")}</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 bg-white">
                    <tr className="bg-slate-50/50"><td colSpan={3} className="px-5 py-2 font-bold text-xs text-slate-500 uppercase tracking-wider">{t("adminDocs.sectionAuth")}</td></tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-slate-800">/api/auth/login</td>
                      <td className="px-5 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">POST</span></td>
                      <td className="px-5 py-3 text-slate-600">{t("adminDocs.apiLogin")}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-slate-800">/api/auth/register</td>
                      <td className="px-5 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">POST</span></td>
                      <td className="px-5 py-3 text-slate-600">{t("adminDocs.apiRegister")}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-slate-800">/api/users/profile</td>
                      <td className="px-5 py-3">
                        <span className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs font-bold mr-1">GET</span>
                        <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-bold">PUT</span>
                      </td>
                      <td className="px-5 py-3 text-slate-600">{t("adminDocs.apiProfile")}</td>
                    </tr>

                    <tr className="bg-slate-50/50"><td colSpan={3} className="px-5 py-2 font-bold text-xs text-slate-500 uppercase tracking-wider">{t("adminDocs.sectionAiGenerator")}</td></tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-slate-800">/api/video-ai/generate</td>
                      <td className="px-5 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">POST</span></td>
                      <td className="px-5 py-3 text-slate-600">{t("adminDocs.apiVideoGenerate")}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-slate-800">/api/image-ai/generate</td>
                      <td className="px-5 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">POST</span></td>
                      <td className="px-5 py-3 text-slate-600">{t("adminDocs.apiImageGenerate")}</td>
                    </tr>

                    <tr className="bg-slate-50/50"><td colSpan={3} className="px-5 py-2 font-bold text-xs text-slate-500 uppercase tracking-wider">{t("adminDocs.sectionPayment")}</td></tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-slate-800">/api/payments/create-invoice</td>
                      <td className="px-5 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">POST</span></td>
                      <td className="px-5 py-3 text-slate-600">{t("adminDocs.apiCreateInvoice")}</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-3 font-mono text-slate-800">/api/payments/webhook</td>
                      <td className="px-5 py-3"><span className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs font-bold">POST</span></td>
                      <td className="px-5 py-3 text-slate-600">{t("adminDocs.apiWebhook")}</td>
                    </tr>
                 </tbody>
               </table>
            </div>

            <h2 className="text-2xl font-bold mb-6 mt-12 border-b border-slate-200 pb-3">{t("adminDocs.responseFormat")}</h2>
            <p className="text-slate-600 mb-6">{t("adminDocs.responseFormatDesc")}</p>

            <CodeBlock 
              title={t("adminDocs.codeRegister")}
              code={`{
  "user": {
    "id": "uuid-...",
    "email": "user@example.com",
    "name": "Budi Santoso",
    "role": "User",
    "coins": 0
  },
  "token": "eyJhbGciOiJIUzI1..."
}`}
            />

            <CodeBlock 
              title={t("adminDocs.codeVideoGenerate")}
              code={`// HTTP Status: 202 (Accepted)
{
  "video": {
    "id": "uuid-lokal-db",
    "jobId": "id-dari-openrouter",
    "status": "processing"
  }
}`}
            />

            <CodeBlock 
              title={t("adminDocs.codeCreateInvoice")}
              code={`{
  "invoiceUrl": "https://checkout-staging.xendit.co/web/...",
  "orderId": "INV-17188...-ABCDEF"
}`}
            />

            <CodeBlock 
              title={t("adminDocs.codeError")}
              code={`// HTTP Status: 400 / 401 / 500
{
  "error": "Prompt is required" 
  // atau "Unauthorized", "User already exists", dll
}`}
            />
          </div>
        )}

        {/* Tab Content: SSO */}
        {activeTab === 'sso' && (
          <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
            <h2 className="text-2xl font-bold mb-6 border-b border-slate-200 pb-3">{t("adminDocs.authArchitecture")}</h2>
            <p className="text-slate-600 mb-6">{t("adminDocs.authDesc")}</p>

            <CodeBlock 
              title="Auth Flow"
              code={`Browser ──→ POST /api/auth/login  (email + password)
        │
        ▼
Supabase Auth  (signInWithPassword)
        │
        ▼
Validasi Role dari database public.users
        │
        ▼
Set HttpOnly Cookie JWT (auth token)
        │
        ▼
Redirect → Dashboard`}
            />

            <h2 className="text-2xl font-bold mb-6 mt-12 border-b border-slate-200 pb-3">{t("adminDocs.cookieStrategy")}</h2>
            <p className="text-slate-600 leading-relaxed mb-6">
              {t("adminDocs.cookieStrategyDesc")}
            </p>
          </div>
        )}

      </main>
    </div>
  )
}