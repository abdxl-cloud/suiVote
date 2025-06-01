"use client"

import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card"

/**
 * Dashboard page skeleton loader
 */
export function DashboardSkeleton() {
  return (
    <div className="container py-10 px-4 md:px-6">
      <div className="flex flex-col gap-6">
        {/* Header skeleton */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <Skeleton className="h-8 w-48 mb-2" />
            <Skeleton className="h-4 w-64" />
          </div>
          <Skeleton className="h-10 w-36" />
        </div>

        {/* Search and filter skeleton */}
        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
          <Skeleton className="h-10 w-full sm:w-[260px]" />
          <Skeleton className="h-10 w-24" />
        </div>

        {/* Vote cards skeleton */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array(6)
            .fill(0)
            .map((_, index) => (
              <Card key={index} className="overflow-hidden">
                <div className="h-2 w-full bg-muted" />
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <Skeleton className="h-6 w-3/4" />
                    <Skeleton className="h-5 w-16 rounded-full" />
                  </div>
                  <Skeleton className="h-4 w-full mt-2" />
                  <Skeleton className="h-4 w-2/3 mt-1" />
                </CardHeader>
                <CardContent>
                  <div className="flex justify-between text-sm">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-4 w-20" />
                  </div>
                  <Skeleton className="h-4 w-32 mt-2" />
                </CardContent>
                <CardFooter className="flex justify-between border-t p-4">
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                  <Skeleton className="h-8 w-20" />
                </CardFooter>
              </Card>
            ))}
        </div>
      </div>
    </div>
  )
}

/**
 * Vote page skeleton loader
 */
export function VoteDetailSkeleton() {
  return (
    <div className="container max-w-4xl py-10 px-4 md:px-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-6 w-full max-w-2xl mb-4" />
        <div className="flex gap-2 mb-4">
          <Skeleton className="h-6 w-24 rounded-full" />
          <Skeleton className="h-6 w-32 rounded-full" />
        </div>
      </div>

      {/* Poll cards skeleton */}
      <div className="space-y-6">
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-2/3" />
              </CardHeader>
              <CardContent className="space-y-4">
                {Array(4)
                  .fill(0)
                  .map((_, optIndex) => (
                    <div key={optIndex} className="flex items-center gap-3">
                      <Skeleton className="h-5 w-5 rounded-full" />
                      <Skeleton className="h-10 flex-1 rounded-md" />
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="mt-8 flex justify-end gap-4">
        <Skeleton className="h-10 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/**
 * Create/Edit vote page skeleton
 */
export function VoteFormSkeleton() {
  return (
    <div className="container max-w-5xl py-10 px-4 md:px-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6">
        <Skeleton className="h-10 w-full max-w-md" />
      </div>

      {/* Form content skeleton */}
      <div className="space-y-8">
        {/* Details section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-24 w-full" />
        </div>

        {/* Polls section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Card>
            <CardHeader>
              <Skeleton className="h-10 w-full mb-2" />
              <Skeleton className="h-20 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array(3)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="h-10 flex-1 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-md" />
                  </div>
                ))}
              <Skeleton className="h-10 w-full max-w-xs mt-4" />
            </CardContent>
          </Card>
        </div>

        {/* Settings section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 mb-2" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>

        {/* Action buttons skeleton */}
        <div className="flex justify-between mt-8">
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>
    </div>
  )
}

/**
 * Vote success page skeleton
 */
export function VoteSuccessSkeleton() {
  return (
    <div className="container max-w-3xl py-10 px-4 md:px-6">
      <Card className="overflow-hidden">
        <div className="h-2 w-full bg-muted" />
        <CardHeader className="text-center">
          <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
          <Skeleton className="h-8 w-64 mx-auto mb-2" />
          <Skeleton className="h-4 w-full max-w-md mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-20 w-full" />
          <div className="flex flex-col sm:flex-row justify-between gap-4">
            <Skeleton className="h-16 w-full sm:w-1/2" />
            <Skeleton className="h-16 w-full sm:w-1/2" />
          </div>
        </CardContent>
        <CardFooter className="flex flex-col sm:flex-row justify-center gap-4 p-6">
          <Skeleton className="h-10 w-full sm:w-40" />
          <Skeleton className="h-10 w-full sm:w-40" />
        </CardFooter>
      </Card>
    </div>
  )
}

/**
 * Edit vote page skeleton
 */
export function EditVoteSkeleton() {
  return (
    <div className="container max-w-5xl py-10 px-4 md:px-6">
      {/* Back button skeleton */}
      <div className="mb-6">
        <Skeleton className="h-9 w-36" />
      </div>
      
      {/* Header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      {/* Alert skeleton */}
      <div className="mb-6">
        <Skeleton className="h-16 w-full rounded-lg" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6">
        <Skeleton className="h-10 w-full max-w-md" />
      </div>

      {/* Form content skeleton */}
      <div className="space-y-8">
        {/* Details section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-10 w-full mb-4" />
          <Skeleton className="h-6 w-32 mb-2" />
          <Skeleton className="h-24 w-full" />
        </div>

        {/* Polls section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-32" />
            <Skeleton className="h-9 w-32" />
          </div>
          
          <Card>
            <CardHeader>
              <div className="flex justify-between items-start">
                <Skeleton className="h-10 w-3/4 mb-2" />
                <Skeleton className="h-9 w-9 rounded-md" />
              </div>
              <Skeleton className="h-20 w-full" />
            </CardHeader>
            <CardContent className="space-y-4">
              {Array(3)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <Skeleton className="h-10 flex-1 rounded-md" />
                    <Skeleton className="h-10 w-10 rounded-md" />
                  </div>
                ))}
              <div className="flex justify-between items-center pt-4">
                <Skeleton className="h-9 w-40" />
                <div className="flex items-center gap-3">
                  <Skeleton className="h-5 w-5 rounded-md" />
                  <Skeleton className="h-5 w-32" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Settings section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 mb-2" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <Skeleton className="h-6 w-40" />
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-6 w-12" />
                </div>
                <Skeleton className="h-10 w-full" />
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Transaction dialog skeleton */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-48" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-4 w-full mb-2" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-6 w-full mt-4" />
            </CardContent>
            <CardFooter className="flex justify-end gap-4">
              <Skeleton className="h-10 w-24" />
              <Skeleton className="h-10 w-32" />
            </CardFooter>
          </Card>
        </div>

        {/* Action buttons skeleton */}
        <div className="flex justify-between mt-8">
          <Skeleton className="h-10 w-24" />
          <div className="flex gap-4">
            <Skeleton className="h-10 w-32" />
            <Skeleton className="h-10 w-32" />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Vote closed page skeleton
 */
export function VoteClosedSkeleton() {
  return (
    <div className="container max-w-4xl py-10 px-4 md:px-6">
      {/* Back button skeleton */}
      <div className="mb-6">
        <Skeleton className="h-9 w-36" />
      </div>
      
      {/* Header skeleton */}
      <div className="mb-6 text-center">
        <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
        <Skeleton className="h-8 w-64 mx-auto mb-2" />
        <Skeleton className="h-5 w-full max-w-md mx-auto" />
      </div>

      {/* Results summary skeleton */}
      <Card className="mb-8">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
        </CardHeader>
        <CardContent>
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-5 w-20" />
            </div>
            <Skeleton className="h-8 w-full" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
              <Skeleton className="h-20 w-full rounded-lg" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Poll results skeleton */}
      <div className="space-y-8">
        <Skeleton className="h-7 w-48" />
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-6 w-3/4 mb-2" />
                <Skeleton className="h-4 w-full" />
              </CardHeader>
              <CardContent className="space-y-6">
                {Array(4)
                  .fill(0)
                  .map((_, optIndex) => (
                    <div key={optIndex} className="space-y-2">
                      <div className="flex justify-between">
                        <Skeleton className="h-5 w-32" />
                        <Skeleton className="h-5 w-16" />
                      </div>
                      <Skeleton className="h-6 w-full rounded-full" />
                    </div>
                  ))}
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Action buttons skeleton */}
      <div className="mt-8 flex justify-center gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/**
 * User profile page skeleton
 */
export function ProfileSkeleton() {
  return (
    <div className="container max-w-4xl py-10 px-4 md:px-6">
      {/* Header skeleton */}
      <div className="mb-8 flex flex-col items-center text-center">
        <Skeleton className="h-24 w-24 rounded-full mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-96 mb-4" />
        <div className="flex gap-3 mb-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Stats cards skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
        {Array(3)
          .fill(0)
          .map((_, index) => (
            <Card key={index}>
              <CardHeader>
                <Skeleton className="h-5 w-24" />
              </CardHeader>
              <CardContent>
                <Skeleton className="h-8 w-20" />
                <Skeleton className="h-4 w-full mt-2" />
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6">
        <Skeleton className="h-10 w-full max-w-md" />
      </div>

      {/* Activity list skeleton */}
      <div className="space-y-4">
        <Skeleton className="h-6 w-48 mb-4" />
        {Array(5)
          .fill(0)
          .map((_, index) => (
            <Card key={index} className="overflow-hidden">
              <div className="h-1 w-full bg-muted" />
              <CardContent className="p-4">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div>
                      <Skeleton className="h-5 w-32 mb-1" />
                      <Skeleton className="h-4 w-48" />
                    </div>
                  </div>
                  <Skeleton className="h-5 w-24" />
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      {/* Pagination skeleton */}
      <div className="mt-6 flex justify-center">
        <Skeleton className="h-10 w-64" />
      </div>
    </div>
  )
}

/**
 * Transaction history page skeleton
 */
export function TransactionHistorySkeleton() {
  return (
    <div className="container max-w-5xl py-10 px-4 md:px-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      {/* Filter controls skeleton */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between mb-6">
        <Skeleton className="h-10 w-full sm:w-[260px]" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-32" />
          <Skeleton className="h-10 w-32" />
        </div>
      </div>

      {/* Transactions table skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <div className="grid grid-cols-12 gap-4">
            <Skeleton className="h-5 w-full col-span-3" />
            <Skeleton className="h-5 w-full col-span-3" />
            <Skeleton className="h-5 w-full col-span-3" />
            <Skeleton className="h-5 w-full col-span-3" />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {Array(8)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="grid grid-cols-12 gap-4 py-3 border-b last:border-0">
                <div className="col-span-3">
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="col-span-3">
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="col-span-3">
                  <Skeleton className="h-5 w-full" />
                </div>
                <div className="col-span-3 flex justify-end">
                  <Skeleton className="h-5 w-24" />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Pagination skeleton */}
      <div className="flex justify-between items-center">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-10 w-64" />
      </div>
    </div>
  )
}

/**
 * Transaction detail skeleton
 */
export function TransactionDetailSkeleton() {
  return (
    <div className="container max-w-3xl py-10 px-4 md:px-6">
      {/* Back button skeleton */}
      <div className="mb-6">
        <Skeleton className="h-9 w-36" />
      </div>
      
      {/* Header skeleton */}
      <div className="mb-6 text-center">
        <Skeleton className="h-16 w-16 rounded-full mx-auto mb-4" />
        <Skeleton className="h-8 w-64 mx-auto mb-2" />
        <Skeleton className="h-5 w-full max-w-md mx-auto" />
      </div>

      {/* Transaction status card */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex justify-between items-center">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-6 w-24 rounded-full" />
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-full" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-6 w-full" />
            </div>
          </div>
          
          <div className="pt-4 border-t">
            <Skeleton className="h-5 w-48 mb-3" />
            <div className="space-y-3">
              {Array(3)
                .fill(0)
                .map((_, index) => (
                  <div key={index} className="flex justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-48" />
                  </div>
                ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action buttons skeleton */}
      <div className="flex justify-center gap-4">
        <Skeleton className="h-10 w-32" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  )
}

/**
 * Wallet connection page skeleton
 */
export function WalletConnectionSkeleton() {
  return (
    <div className="container max-w-md py-10 px-4 md:px-6">
      <div className="flex flex-col items-center text-center mb-8">
        <Skeleton className="h-20 w-20 rounded-full mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-5 w-full max-w-sm mx-auto" />
      </div>

      {/* Wallet options skeleton */}
      <Card className="mb-6">
        <CardHeader>
          <Skeleton className="h-6 w-48 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          {Array(4)
            .fill(0)
            .map((_, index) => (
              <div key={index} className="flex items-center p-3 border rounded-lg">
                <Skeleton className="h-10 w-10 rounded-md mr-3" />
                <div className="flex-1">
                  <Skeleton className="h-5 w-32 mb-1" />
                  <Skeleton className="h-4 w-48" />
                </div>
              </div>
            ))}
        </CardContent>
      </Card>

      {/* Info section skeleton */}
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-40 mx-auto" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
          <div className="flex justify-center mt-2">
            <Skeleton className="h-9 w-32" />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

/**
 * Settings page skeleton
 */
export function SettingsSkeleton() {
  return (
    <div className="container max-w-4xl py-10 px-4 md:px-6">
      {/* Header skeleton */}
      <div className="mb-6">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-5 w-full max-w-xl" />
      </div>

      {/* Tabs skeleton */}
      <div className="mb-6">
        <Skeleton className="h-10 w-full max-w-md" />
      </div>

      {/* Settings sections */}
      <div className="space-y-8">
        {/* Account section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Card>
            <CardHeader>
              <div className="flex items-center gap-4">
                <Skeleton className="h-16 w-16 rounded-full" />
                <div>
                  <Skeleton className="h-6 w-48 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-10 w-full" />
              </div>
              <div className="flex justify-end">
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Preferences section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-40 mb-2" />
          <Card>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-5 w-48 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-5 w-48 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-6 w-12" />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Skeleton className="h-5 w-48 mb-1" />
                  <Skeleton className="h-4 w-64" />
                </div>
                <Skeleton className="h-10 w-32" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Security section */}
        <div className="space-y-4">
          <Skeleton className="h-6 w-32 mb-2" />
          <Card>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Skeleton className="h-5 w-48 mb-1" />
                <Skeleton className="h-4 w-full max-w-lg" />
                <div className="flex gap-4 mt-2">
                  <Skeleton className="h-10 w-32" />
                  <Skeleton className="h-10 w-32" />
                </div>
              </div>
              <div className="pt-4 border-t">
                <Skeleton className="h-5 w-48 mb-1" />
                <Skeleton className="h-4 w-full max-w-lg" />
                <Skeleton className="h-10 w-32 mt-2" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}