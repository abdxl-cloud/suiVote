"use client"

import { useState } from "react"
import Link from "next/link"
import { motion } from "framer-motion"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { toast } from "@/components/ui/use-toast"
import { Check, Copy, Share2, BarChart3, Edit, Home, Plus } from "lucide-react"

export default function SuccessPage() {
  const [copied, setCopied] = useState(false)

  // This would be dynamic in a real implementation
  const voteId = "123456"
  const voteUrl = `https://suivote.com/vote/${voteId}`

  const copyToClipboard = () => {
    navigator.clipboard.writeText(voteUrl)
    setCopied(true)
    toast({
      title: "Link copied!",
      description: "Vote link copied to clipboard",
    })

    setTimeout(() => setCopied(false), 2000)
  }

  const shareVote = () => {
    if (navigator.share) {
      navigator.share({
        title: "Check out my SuiVote poll!",
        text: "I've created a new vote. Check it out and cast your vote!",
        url: voteUrl,
      })
    } else {
      copyToClipboard()
    }
  }

  const container = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: {
        staggerChildren: 0.1,
      },
    },
  }

  const item = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 },
  }

  return (
    <motion.div className="container max-w-4xl mx-auto px-4 py-8" initial="hidden" animate="show" variants={container}>
      <motion.div variants={item} className="flex items-center justify-center mb-8">
        <div className="bg-green-100 dark:bg-green-900 rounded-full p-3">
          <Check className="h-8 w-8 text-green-600 dark:text-green-300" />
        </div>
      </motion.div>

      <motion.h1 variants={item} className="text-3xl md:text-4xl font-bold text-center mb-2">
        Vote Created Successfully!
      </motion.h1>

      <motion.p variants={item} className="text-muted-foreground text-center mb-8">
        Your vote has been created and is ready to share
      </motion.p>

      <motion.div variants={item} className="space-y-6">
        {/* Share Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Share Your Vote</CardTitle>
            <CardDescription>Share this link with others so they can participate</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted rounded-md break-all text-sm">{voteUrl}</div>
            <div className="flex flex-wrap gap-2">
              <Button onClick={copyToClipboard} className="flex-1 sm:flex-none">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                Copy Link
              </Button>
              <Button onClick={shareVote} variant="outline" className="flex-1 sm:flex-none">
                <Share2 className="mr-2 h-4 w-4" />
                Share
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Analytics Card */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>Vote Analytics</CardTitle>
            <CardDescription>Track participation and results</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">
              View real-time analytics for your vote, including participation rates and results as they come in.
            </p>
            <Button asChild>
              <Link href={`/vote/${voteId}/analytics`}>
                <BarChart3 className="mr-2 h-4 w-4" />
                View Analytics
              </Link>
            </Button>
          </CardContent>
        </Card>

        {/* Actions */}
        <Card className="w-full">
          <CardHeader>
            <CardTitle>What's Next?</CardTitle>
            <CardDescription>Manage your vote or create another</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Button asChild variant="outline" className="h-auto py-4 justify-start">
                <Link href={`/edit/${voteId}`} className="flex flex-col items-start">
                  <div className="flex items-center w-full">
                    <Edit className="h-5 w-5 mr-2" />
                    <span className="font-medium">Edit Vote</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">Make changes to your vote settings</span>
                </Link>
              </Button>

              <Button asChild variant="outline" className="h-auto py-4 justify-start">
                <Link href="/dashboard" className="flex flex-col items-start">
                  <div className="flex items-center w-full">
                    <Home className="h-5 w-5 mr-2" />
                    <span className="font-medium">Dashboard</span>
                  </div>
                  <span className="text-xs text-muted-foreground mt-1">Return to your vote dashboard</span>
                </Link>
              </Button>
            </div>
          </CardContent>
          <CardFooter className="flex flex-col sm:flex-row gap-4 pt-6">
            <Separator className="sm:hidden" />
            <Button asChild className="w-full sm:w-auto">
              <Link href="/create">
                <Plus className="mr-2 h-4 w-4" />
                Create Another Vote
              </Link>
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </motion.div>
  )
}
