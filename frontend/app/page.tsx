"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { motion, useScroll, useTransform, AnimatePresence } from "framer-motion"
import { ArrowRight, ShieldCheck, BarChart2, Vote, ChevronDown, Star, CheckCircle, ArrowDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { WalletConnectButton } from "@/components/wallet-connect-button"

export default function LandingPage() {
  const [scrolled, setScrolled] = useState(false)
  const [activeTestimonial, setActiveTestimonial] = useState(0)
  const heroRef = useRef<HTMLDivElement>(null)
  const featuresRef = useRef<HTMLDivElement>(null)

  // Scroll-based animations
  const { scrollYProgress } = useScroll()
  const heroOpacity = useTransform(scrollYProgress, [0, 0.2], [1, 0])
  const heroScale = useTransform(scrollYProgress, [0, 0.2], [1, 0.95])

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50)
    }

    window.addEventListener("scroll", handleScroll)
    return () => window.removeEventListener("scroll", handleScroll)
  }, [])

  useEffect(() => {
    // Auto-rotate testimonials
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % testimonials.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const scrollToSection = (ref: React.RefObject<HTMLDivElement>) => {
    ref.current?.scrollIntoView({ behavior: "smooth" })
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.2,
        delayChildren: 0.3,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0, transition: { duration: 0.8, ease: [0.04, 0.62, 0.23, 0.98] } },
  }

  const testimonials = [
    {
      quote: "SuiVote has transformed how our community makes decisions. The process is transparent and secure.",
      author: "Alex Johnson",
      role: "Community Manager",
      avatar: "/placeholder.svg?height=60&width=60",
    },
    {
      quote:
        "The best voting platform I've used. Setting up polls is intuitive and the results are easy to understand.",
      author: "Maria Garcia",
      role: "Project Lead",
      avatar: "/placeholder.svg?height=60&width=60",
    },
    {
      quote:
        "We use SuiVote for all our governance decisions. The token-gating feature ensures only stakeholders vote.",
      author: "David Chen",
      role: "DAO Founder",
      avatar: "/placeholder.svg?height=60&width=60",
    },
  ]

  return (
    <>
      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 w-full transition-all duration-500",
          scrolled ? "bg-background/95 backdrop-blur-md shadow-sm py-2" : "bg-transparent py-4",
        )}
      >
        <div className="container flex items-center justify-between">
          <a href="#top" className="flex items-center gap-2 group">
            <div className="rounded-full bg-gradient-to-tr from-primary to-primary/80 p-1.5 group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300">
              <div className="h-5 w-5 rounded-full bg-white" />
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80 group-hover:from-primary/80 group-hover:to-primary transition-all duration-300">
              SuiVote
            </span>
          </a>

          <div className="flex items-center gap-4">
            <nav className="hidden md:flex items-center gap-6">
              <a
                href="#features"
                className="text-sm font-medium hover:text-primary transition-colors relative group"
                onClick={(e) => {
                  e.preventDefault()
                  scrollToSection(featuresRef)
                }}
              >
                Features
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="#how-it-works"
                className="text-sm font-medium hover:text-primary transition-colors relative group"
              >
                How It Works
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a
                href="#testimonials"
                className="text-sm font-medium hover:text-primary transition-colors relative group"
              >
                Testimonials
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
              </a>
              <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors relative group">
                FAQ
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
              </a>
              <Link
                href="/dashboard"
                className="text-sm font-medium hover:text-primary transition-colors relative group"
              >
                Dashboard
                <span className="absolute -bottom-1 left-0 w-0 h-0.5 bg-primary transition-all duration-300 group-hover:w-full"></span>
              </Link>
            </nav>
            <WalletConnectButton variant="landing" />
          </div>
        </div>
      </header>

      {/* Rest of the landing page content remains the same */}

      <main>
        {/* Hero Section */}
        <section
          id="top"
          ref={heroRef}
          className="relative min-h-screen flex items-center pt-28 md:pt-32 overflow-hidden"
        >
          {/* Animated background */}
          <div className="absolute inset-0 -z-10">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(120,119,198,0.3),transparent_40%)]"></div>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,rgba(120,119,198,0.3),transparent_40%)]"></div>

            {/* Animated shapes */}
            <motion.div
              className="absolute top-1/4 left-1/4 w-64 h-64 rounded-full bg-primary/5 blur-3xl"
              animate={{
                x: [0, 30, 0],
                y: [0, -30, 0],
                scale: [1, 1.1, 1],
              }}
              transition={{
                duration: 15,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse",
              }}
            />
            <motion.div
              className="absolute bottom-1/3 right-1/4 w-96 h-96 rounded-full bg-primary/10 blur-3xl"
              animate={{
                x: [0, -40, 0],
                y: [0, 40, 0],
                scale: [1, 1.2, 1],
              }}
              transition={{
                duration: 20,
                repeat: Number.POSITIVE_INFINITY,
                repeatType: "reverse",
              }}
            />

            {/* Grid pattern */}
            <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] dark:opacity-[0.02]"></div>
          </div>

          <motion.div
            style={{ opacity: heroOpacity, scale: heroScale }}
            className="container flex flex-col items-center text-center z-10"
          >
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="max-w-3xl"
            >
              <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm">
                Secure Decentralized Voting Platform
              </div>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl lg:text-7xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                Decentralized Voting on Sui
              </h1>
              <p className="mt-6 text-lg text-muted-foreground md:text-xl max-w-2xl mx-auto">
                Create, participate, and manage polls securely with SUI Wallet integration. Built for communities that
                value transparency and security.
              </p>
              <div className="mt-10 flex flex-col sm:flex-row justify-center gap-4">
                <Link href="/create">
                  <Button
                    size="lg"
                    className="gap-2 text-base bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105 w-full sm:w-auto"
                  >
                    Create Poll
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.4, ease: [0.04, 0.62, 0.23, 0.98] }}
              className="mt-16 w-full max-w-5xl"
            >
              <div className="relative">
                {/* Decorative elements */}
                <div className="absolute -top-8 -left-8 w-16 h-16 bg-primary/10 rounded-full blur-xl"></div>
                <div className="absolute -bottom-8 -right-8 w-16 h-16 bg-primary/10 rounded-full blur-xl"></div>

                <div className="relative rounded-xl overflow-hidden shadow-2xl border border-primary/10">
                  <div className="absolute inset-0 bg-gradient-to-b from-transparent to-black/30 z-10"></div>
                  <img
                    src="/placeholder.svg?height=600&width=1200"
                    alt="SuiVote Dashboard Preview"
                    className="w-full h-auto object-cover"
                  />

                  {/* Browser-like UI elements */}
                  <div className="absolute top-0 left-0 right-0 h-8 bg-background/90 backdrop-blur-sm flex items-center px-4 gap-2 z-20">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-4 h-5 w-64 rounded-full bg-muted/50"></div>
                  </div>
                </div>

                {/* Floating badges */}
                <motion.div
                  className="absolute -right-4 top-1/4 bg-background shadow-lg rounded-lg p-3 z-20 border border-primary/10"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.8, duration: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-green-500/10 p-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-sm font-medium">Votes Secured</span>
                  </div>
                </motion.div>

                <motion.div
                  className="absolute -left-4 bottom-1/4 bg-background shadow-lg rounded-lg p-3 z-20 border border-primary/10"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 1, duration: 0.5 }}
                >
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-primary/10 p-2">
                      <BarChart2 className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-sm font-medium">Real-time Results</span>
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* Scroll indicator */}
            <motion.div
              className="absolute bottom-8 left-1/2 transform -translate-x-1/2"
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.5, duration: 0.5 }}
            >
              <motion.div
                animate={{ y: [0, 10, 0] }}
                transition={{ duration: 1.5, repeat: Number.POSITIVE_INFINITY }}
                className="flex flex-col items-center gap-2"
              >
                <span className="text-sm text-muted-foreground">Scroll to explore</span>
                <ArrowDown className="h-5 w-5 text-primary" />
              </motion.div>
            </motion.div>
          </motion.div>
        </section>

        {/* Features Section */}
        <section id="features" ref={featuresRef} className="py-24 bg-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] dark:opacity-[0.03]"></div>

          <div className="container relative z-10">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm">
                  Powerful Features
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  Everything You Need
                </h2>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  SuiVote provides all the tools you need to create and manage secure decentralized votes
                </p>
              </motion.div>
            </div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              className="grid grid-cols-1 md:grid-cols-3 gap-8"
            >
              <motion.div
                variants={item}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-background rounded-xl p-8 shadow-lg border border-primary/10 flex flex-col items-center text-center relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="rounded-full bg-primary/10 p-4 mb-6 relative">
                  <Vote className="h-8 w-8 text-primary" />
                  <span className="absolute -right-1 -top-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                    1
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3">Create Polls</h3>
                <p className="text-muted-foreground">
                  Easily create custom polls with multiple options, descriptions, and voting rules. Support for images
                  and rich media.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-left w-full">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Multiple choice or single selection</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Custom media attachments</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Flexible voting rules</span>
                  </li>
                </ul>
              </motion.div>

              <motion.div
                variants={item}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-background rounded-xl p-8 shadow-lg border border-primary/10 flex flex-col items-center text-center relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="rounded-full bg-primary/10 p-4 mb-6 relative">
                  <ShieldCheck className="h-8 w-8 text-primary" />
                  <span className="absolute -right-1 -top-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                    2
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3">Secure Voting</h3>
                <p className="text-muted-foreground">
                  Each vote is securely recorded on the blockchain via your SUI Wallet, ensuring transparency and
                  immutability.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-left w-full">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Blockchain-verified votes</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Token-gated access control</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Tamper-proof results</span>
                  </li>
                </ul>
              </motion.div>

              <motion.div
                variants={item}
                whileHover={{ y: -5, transition: { duration: 0.2 } }}
                className="bg-background rounded-xl p-8 shadow-lg border border-primary/10 flex flex-col items-center text-center relative group"
              >
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl"></div>
                <div className="rounded-full bg-primary/10 p-4 mb-6 relative">
                  <BarChart2 className="h-8 w-8 text-primary" />
                  <span className="absolute -right-1 -top-1 w-4 h-4 bg-primary rounded-full flex items-center justify-center text-[10px] text-white font-bold">
                    3
                  </span>
                </div>
                <h3 className="text-xl font-bold mb-3">Real-time Results</h3>
                <p className="text-muted-foreground">
                  View live voting statistics and results as votes come in. Beautiful visualizations make data easy to
                  understand.
                </p>
                <ul className="mt-4 space-y-2 text-sm text-left w-full">
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Live updating charts</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Detailed analytics</span>
                  </li>
                  <li className="flex items-center">
                    <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                    <span>Exportable results</span>
                  </li>
                </ul>
              </motion.div>
            </motion.div>

            {/* Stats section */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.7, delay: 0.2 }}
              className="mt-20 grid grid-cols-2 md:grid-cols-4 gap-8"
            >
              <div className="bg-background rounded-lg p-6 shadow-md border border-primary/10 text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">10k+</div>
                <div className="text-sm text-muted-foreground">Active Users</div>
              </div>
              <div className="bg-background rounded-lg p-6 shadow-md border border-primary/10 text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">50k+</div>
                <div className="text-sm text-muted-foreground">Votes Created</div>
              </div>
              <div className="bg-background rounded-lg p-6 shadow-md border border-primary/10 text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime</div>
              </div>
              <div className="bg-background rounded-lg p-6 shadow-md border border-primary/10 text-center">
                <div className="text-3xl md:text-4xl font-bold text-primary mb-2">1M+</div>
                <div className="text-sm text-muted-foreground">Votes Cast</div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] dark:opacity-[0.02]"></div>

          <div className="container relative z-10">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm">
                  Simple Process
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  How It Works
                </h2>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  Simple steps to create and participate in decentralized voting
                </p>
              </motion.div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
              <motion.div
                initial={{ opacity: 0, x: -30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
              >
                <div className="space-y-12">
                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-xl shadow-lg">
                        1
                      </div>
                      <div className="h-full w-0.5 bg-gradient-to-b from-primary/50 to-transparent mx-auto mt-2"></div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Connect Your Wallet</h3>
                      <p className="text-muted-foreground">
                        Link your SUI wallet to authenticate and enable secure voting. Your wallet serves as your secure
                        identity on the platform.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-xl shadow-lg">
                        2
                      </div>
                      <div className="h-full w-0.5 bg-gradient-to-b from-primary/50 to-transparent mx-auto mt-2"></div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Create or Browse Votes</h3>
                      <p className="text-muted-foreground">
                        Set up your own custom vote or participate in existing ones. Our intuitive interface makes
                        creating polls simple and fast.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-xl shadow-lg">
                        3
                      </div>
                      <div className="h-full w-0.5 bg-gradient-to-b from-primary/50 to-transparent mx-auto mt-2"></div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">Vote Securely</h3>
                      <p className="text-muted-foreground">
                        Cast your vote which is securely recorded on the Sui blockchain. Each vote is transparent and
                        immutable.
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-6">
                    <div className="flex-shrink-0">
                      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground font-bold text-xl shadow-lg">
                        4
                      </div>
                    </div>
                    <div>
                      <h3 className="text-xl font-bold mb-3">View Real-time Results</h3>
                      <p className="text-muted-foreground">
                        Track voting progress and see final results when the poll closes. Share results with your
                        community.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="relative"
              >
                <div className="absolute -inset-4 rounded-xl bg-gradient-to-r from-primary/20 to-primary/5 blur-xl"></div>
                <div className="relative rounded-xl overflow-hidden shadow-xl border border-primary/10">
                  {/* Browser-like UI elements */}
                  <div className="absolute top-0 left-0 right-0 h-8 bg-background/90 backdrop-blur-sm flex items-center px-4 gap-2 z-20">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <div className="w-3 h-3 rounded-full bg-yellow-500"></div>
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="ml-4 h-5 w-64 rounded-full bg-muted/50"></div>
                  </div>

                  <img src="/placeholder.svg?height=500&width=600" alt="SuiVote Process" className="w-full h-auto" />

                  {/* Floating UI elements */}
                  <motion.div
                    className="absolute top-1/4 right-4 bg-background/90 backdrop-blur-sm shadow-lg rounded-lg p-3 border border-primary/10 flex items-center gap-2"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="rounded-full bg-green-500/10 p-1.5">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    </div>
                    <span className="text-xs font-medium">Vote Recorded</span>
                  </motion.div>

                  <motion.div
                    className="absolute bottom-1/4 left-4 bg-background/90 backdrop-blur-sm shadow-lg rounded-lg p-3 border border-primary/10"
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.7 }}
                  >
                    <div className="h-2 w-32 bg-muted rounded-full">
                      <div className="h-2 w-3/4 bg-primary rounded-full"></div>
                    </div>
                    <div className="mt-1 flex justify-between text-xs">
                      <span>Option A</span>
                      <span className="font-medium">75%</span>
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* Testimonials Section */}
        <section id="testimonials" className="py-24 bg-muted/30 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] dark:opacity-[0.03]"></div>

          <div className="container relative z-10">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm">
                  Testimonials
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  What Our Users Say
                </h2>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  Join thousands of satisfied users who trust SuiVote for their voting needs
                </p>
              </motion.div>
            </div>

            <div className="max-w-4xl mx-auto">
              <div className="relative">
                <AnimatePresence mode="wait">
                  {testimonials.map(
                    (testimonial, index) =>
                      activeTestimonial === index && (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          transition={{ duration: 0.5 }}
                          className="bg-background rounded-xl p-8 md:p-10 shadow-lg border border-primary/10 text-center"
                        >
                          <div className="flex justify-center mb-6">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className="h-6 w-6 text-yellow-500 fill-yellow-500" />
                            ))}
                          </div>
                          <p className="text-xl md:text-2xl italic mb-8 font-serif">"{testimonial.quote}"</p>
                          <div className="flex items-center justify-center gap-4">
                            <div className="w-12 h-12 rounded-full overflow-hidden">
                              <img
                                src={testimonial.avatar || "/placeholder.svg"}
                                alt={testimonial.author}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <div className="text-left">
                              <div className="font-bold">{testimonial.author}</div>
                              <div className="text-sm text-muted-foreground">{testimonial.role}</div>
                            </div>
                          </div>
                        </motion.div>
                      ),
                  )}
                </AnimatePresence>

                {/* Testimonial navigation */}
                <div className="flex justify-center mt-8 gap-2">
                  {testimonials.map((_, index) => (
                    <button
                      key={index}
                      onClick={() => setActiveTestimonial(index)}
                      className={`w-3 h-3 rounded-full transition-all duration-300 ${
                        activeTestimonial === index ? "bg-primary scale-125" : "bg-primary/30"
                      }`}
                      aria-label={`View testimonial ${index + 1}`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ Section */}
        <section id="faq" className="py-24 relative overflow-hidden">
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02] dark:opacity-[0.02]"></div>

          <div className="container relative z-10 max-w-3xl">
            <div className="text-center mb-16">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-primary/10 text-primary font-medium text-sm">
                  FAQ
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-4xl bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">
                  Frequently Asked Questions
                </h2>
                <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
                  Common questions about SuiVote and decentralized voting
                </p>
              </motion.div>
            </div>

            <motion.div
              variants={container}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              className="space-y-4"
            >
              {[
                {
                  question: "What is SuiVote?",
                  answer:
                    "SuiVote is a decentralized voting platform built on the Sui blockchain that allows users to create, participate in, and manage secure polls with transparent results.",
                },
                {
                  question: "Do I need a Sui wallet to use SuiVote?",
                  answer:
                    "Yes, you need a Sui wallet to authenticate and participate in voting. This ensures security and prevents duplicate voting.",
                },
                {
                  question: "Is voting anonymous?",
                  answer:
                    "Voting is pseudonymous. While your wallet address is recorded with your vote for verification purposes, your personal identity is not linked unless you choose to share it.",
                },
                {
                  question: "Can I create polls with token-gated access?",
                  answer:
                    "Yes, you can create polls that require participants to hold specific tokens or a minimum token amount to be eligible to vote.",
                },
                {
                  question: "How are the results verified?",
                  answer:
                    "All votes are recorded on the Sui blockchain, making the results transparent, immutable, and verifiable by anyone.",
                },
              ].map((faq, index) => (
                <motion.div
                  key={index}
                  variants={item}
                  className="bg-background rounded-lg border border-primary/10 shadow-sm overflow-hidden"
                >
                  <details className="group">
                    <summary className="flex cursor-pointer items-center justify-between p-4 text-lg font-medium">
                      {faq.question}
                      <ChevronDown className="h-5 w-5 transition-transform duration-300 group-open:rotate-180" />
                    </summary>
                    <div className="border-t px-4 py-3 text-muted-foreground">
                      <p>{faq.answer}</p>
                    </div>
                  </details>
                </motion.div>
              ))}
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="mt-16 text-center"
            >
              <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl p-8 border border-primary/10">
                <h3 className="text-2xl font-bold mb-4">Ready to get started?</h3>
                <p className="text-muted-foreground mb-6 max-w-lg mx-auto">
                  Join thousands of communities already using SuiVote for secure, transparent decision-making.
                </p>
                <Link href="/create">
                  <Button
                    size="lg"
                    className="gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary shadow-lg hover:shadow-primary/25 transition-all duration-300 hover:scale-105"
                  >
                    Create Your First Poll
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t py-16 bg-muted/30 relative">
        <div className="absolute inset-0 bg-grid-pattern opacity-[0.03] dark:opacity-[0.03]"></div>

        <div className="container relative z-10">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2 mb-4">
                <div className="rounded-full bg-gradient-to-tr from-primary to-primary/80 p-1.5">
                  <div className="h-5 w-5 rounded-full bg-white" />
                </div>
                <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-primary to-primary/80">
                  SuiVote
                </span>
              </div>
              <p className="text-muted-foreground max-w-md">
                SuiVote is the leading decentralized voting platform built on the Sui blockchain, providing secure,
                transparent, and efficient voting solutions for communities of all sizes.
              </p>
              <div className="flex gap-4 mt-6">
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"></path>
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"></path>
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"></path>
                  </svg>
                </a>
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="20"
                    height="20"
                    fill="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path d="M12 12.713l-11.985-9.713h23.97l-11.985 9.713zm0 2.574l-12-9.725v15.438h24v-15.438l-12 9.725z"></path>
                  </svg>
                </a>
              </div>
            </div>

            <div>
              <h3 className="font-bold mb-4">Product</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#features" className="text-muted-foreground hover:text-primary transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#how-it-works" className="text-muted-foreground hover:text-primary transition-colors">
                    How It Works
                  </a>
                </li>
                <li>
                  <a href="#testimonials" className="text-muted-foreground hover:text-primary transition-colors">
                    Testimonials
                  </a>
                </li>
                <li>
                  <a href="#faq" className="text-muted-foreground hover:text-primary transition-colors">
                    FAQ
                  </a>
                </li>
              </ul>
            </div>

            <div>
              <h3 className="font-bold mb-4">Legal</h3>
              <ul className="space-y-2">
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    Cookie Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="text-muted-foreground hover:text-primary transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-10 pt-6 flex flex-col md:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">© {new Date().getFullYear()} SuiVote. All rights reserved.</p>
            <p className="text-sm text-muted-foreground mt-2 md:mt-0">Made with ❤️ by Abdul</p>
          </div>
        </div>
      </footer>
    </>
  )
}
