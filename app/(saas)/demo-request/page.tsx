'use client';

import Link from 'next/link';
import { useState } from 'react';
import axios from 'axios';
import {
  CheckCircle2,
  Home,
  Loader2,
  LogIn,
  PlusCircle,
  SendHorizonal,
} from 'lucide-react';
import { toast } from 'react-toastify';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function DemoRequestPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [restaurant, setRestaurant] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await axios.post('/api/demo-request', {
        name: name.trim(),
        email: email.trim(),
        restaurant: restaurant.trim(),
      });
      setSubmitted(true);
    } catch (error: unknown) {
      const msg =
        axios.isAxiosError(error) && error.response?.data?.error
          ? typeof error.response.data.error === 'string'
            ? error.response.data.error
            : 'Could not submit demo request.'
          : 'Could not submit demo request.';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }

  function startNewRequest() {
    setSubmitted(false);
    setName('');
    setEmail('');
    setRestaurant('');
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-white px-6 py-16 text-zinc-900 dark:bg-black dark:text-white">
      <div className="pointer-events-none absolute -left-24 top-0 h-72 w-72 rounded-full bg-fire-500/20 blur-3xl dark:bg-fire-500/25" />
      <div className="pointer-events-none absolute -bottom-20 right-0 h-72 w-72 rounded-full bg-fire-300/20 blur-3xl dark:bg-fire-700/20" />
      <div className="relative mx-auto max-w-2xl rounded-3xl border border-zinc-200/80 bg-white/95 p-8 shadow-[0_30px_80px_-30px] shadow-black/20 backdrop-blur-sm dark:border-zinc-800/80 dark:bg-zinc-950/80 dark:shadow-black/60">

        {submitted ? (
          <div className="text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="h-9 w-9" strokeWidth={2.5} />
            </div>
            <h1 className="mt-5 text-3xl font-bold md:text-4xl">Request sent</h1>
            <p className="mt-3 text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">
              Your demo request was submitted successfully. Check your email to
              stay updated about your request.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={startNewRequest}
              >
                <PlusCircle className="mr-2 h-4 w-4" />
                New request
              </Button>
              <Button
                asChild
                className="w-full bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-white hover:from-fire-400 hover:to-fire-500 sm:w-auto"
              >
                <Link href="/">
                  <Home className="mr-2 h-4 w-4" />
                  Back to homepage
                </Link>
              </Button>
            </div>
          </div>
        ) : (
          <>
            <h1 className="text-3xl font-bold md:text-4xl">Request a Demo</h1>
            <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
              See how Foodluk SaaS can fit your operation in a guided product
              walkthrough.
            </p>

            <form className="mt-8 space-y-4" onSubmit={onSubmit}>
              <div className="space-y-2">
                <Label htmlFor="name">Your name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Business email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="restaurant">Restaurant / brand name</Label>
                <Input
                  id="restaurant"
                  value={restaurant}
                  onChange={(e) => setRestaurant(e.target.value)}
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="bg-gradient-to-r from-fire-500 via-fire-600 to-fire-500 text-white hover:from-fire-400 hover:to-fire-500"
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    <span>Submitting...</span>
                  </>
                ) : (
                  <>
                    <span>Submit Demo Request</span>
                    <SendHorizonal className="ml-1 h-4 w-4" />
                  </>
                )}
              </Button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
