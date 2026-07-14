'use client'

import { useEffect, useState } from 'react'

interface UserSettings {
  email?: string
  currency?: string
  theme?: 'dark' | 'light'
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<UserSettings>({
    email: '',
    currency: 'USD',
    theme: 'dark',
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Load user settings from Supabase
    setLoading(false)
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-[#EEE8F5] mb-2">Settings</h1>
        <p className="text-[#8B8BA8]">Manage your account preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Section */}
        <div className="lg:col-span-2 space-y-6">
          <SettingsSection title="Account">
            <div>
              <label className="block text-[#EEE8F5] mb-2 font-semibold">Email</label>
              <input
                type="email"
                disabled
                className="w-full px-4 py-2 rounded-lg bg-[#12103A] border border-white/10 text-[#8B8BA8] cursor-not-allowed"
                placeholder="Your email"
              />
              <p className="text-xs text-[#8B8BA8] mt-2">Contact support to change email</p>
            </div>
          </SettingsSection>

          <SettingsSection title="Preferences">
            <div className="space-y-4">
              <div>
                <label className="block text-[#EEE8F5] mb-2 font-semibold">Currency</label>
                <select className="w-full px-4 py-2 rounded-lg bg-[#12103A] border border-white/10 text-[#EEE8F5] focus:outline-none focus:border-[#6D28D9]">
                  <option>USD - US Dollar</option>
                  <option>EUR - Euro</option>
                  <option>GBP - British Pound</option>
                  <option>CAD - Canadian Dollar</option>
                </select>
              </div>

              <div>
                <label className="block text-[#EEE8F5] mb-2 font-semibold">Theme</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      value="dark"
                      defaultChecked
                      className="w-4 h-4"
                    />
                    <span className="text-[#EEE8F5]">Dark</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="theme"
                      value="light"
                      disabled
                      className="w-4 h-4 opacity-50 cursor-not-allowed"
                    />
                    <span className="text-[#8B8BA8]">Light (Coming soon)</span>
                  </label>
                </div>
              </div>
            </div>
          </SettingsSection>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <SettingsSection title="Danger Zone">
            <button className="w-full px-4 py-2 bg-red-500/20 text-red-300 rounded-lg font-semibold hover:bg-red-500/30 transition-colors border border-red-500/30">
              Delete Account
            </button>
            <p className="text-xs text-[#8B8BA8] mt-2">This action cannot be undone</p>
          </SettingsSection>

          <SettingsSection title="App Version">
            <p className="text-[#EEE8F5]">v0.1.0 (Beta)</p>
          </SettingsSection>
        </div>
      </div>
    </div>
  )
}

interface SettingsSectionProps {
  title: string
  children: React.ReactNode
}

function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <div className="p-6 rounded-lg border border-white/10 bg-[#0D0B28]">
      <h2 className="font-bold text-[#EEE8F5] mb-4">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  )
}
