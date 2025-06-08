import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"

export default function VoteDetailsLoading() {
  return (
    <div className="container mx-auto px-4 py-8">
      {/* Header Skeleton */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-20" /> {/* Back button */}
          <div>
            <Skeleton className="h-8 w-64 mb-2" /> {/* Title */}
            <Skeleton className="h-4 w-48" /> {/* Date */}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Skeleton className="h-9 w-20" /> {/* Refresh */}
          <Skeleton className="h-9 w-20" /> {/* Share */}
          <Skeleton className="h-9 w-16" /> {/* Edit */}
          <Skeleton className="h-9 w-24" /> {/* View */}
        </div>
      </div>

      {/* Quick Stats Skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <Skeleton className="h-4 w-4" />
                <Skeleton className="h-4 w-20" />
              </div>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-16" />
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Tabs Skeleton */}
      <div className="space-y-6">
        <div className="flex space-x-1 bg-muted p-1 rounded-lg w-fit">
          {['Overview', 'Voters', 'Results', 'Analytics'].map((tab) => (
            <Skeleton key={tab} className="h-9 w-24" />
          ))}
        </div>

        {/* Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-32" />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Skeleton className="h-4 w-20 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-3/4" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
                <div>
                  <Skeleton className="h-4 w-16 mb-2" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <div>
                  <Skeleton className="h-4 w-20 mb-2" />
                  <Skeleton className="h-4 w-12" />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Right Column */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-5" />
                <Skeleton className="h-6 w-32" />
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
              <div className="my-4">
                <Skeleton className="h-px w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-4 w-48" />
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Additional Content Skeleton */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {[...Array(2)].map((_, i) => (
            <Card key={i}>
              <CardHeader>
                <Skeleton className="h-6 w-48" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-64 w-full" /> {/* Chart placeholder */}
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}