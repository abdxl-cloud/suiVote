"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner" // Only use Sonner
import {
  PlusCircle,
  Trash2,
  ArrowRight,
  Calendar,
  ImageIcon,
  Coins,
  Wallet,
  AlertCircle,
  Circle,
  Settings,
  ChevronLeft,
  ChevronRight,
  BarChart2,
  Info,
  FileText,
  ListChecks,
  X,
  Check,
  Loader2,
  Clock,
  GripVertical,
} from "lucide-react"

// Import dnd-kit components
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
} from "@dnd-kit/core"
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable"
import { CSS } from "@dnd-kit/utilities"
import { Button } from "@/components/ui/button"
import { LoadingButton } from "@/components/ui/loading-button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Slider } from "@/components/ui/slider"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DateTimePicker } from "@/components/date-time-picker"
import { isAfter, addDays } from "date-fns"
import { motion, AnimatePresence } from "framer-motion"
import { cn } from "@/lib/utils"
import Link from "next/link"
import { useWallet } from "@/contexts/wallet-context"
import { useSuiVote } from "@/hooks/use-suivote"
import { SUI_CONFIG } from "@/config/sui-config"
import { Progress } from "@/components/ui/progress"
import { TokenSelector } from "@/components/token-selector"
import { WhitelistSelector } from "@/components/whitelist-selector"
import { VoteMediaHandler } from "@/components/media-handler";
import { TransactionStatusDialog, TransactionStatus } from "@/components/transaction-status-dialog";

type PollType = {
  id: string
  title: string
  description: string
  options: {
    id: string
    text: string
    mediaUrl: string | null
  }[]
  isMultiSelect: boolean
  maxSelections: number
  isRequired: boolean
}

type VotingSettings = {
  requiredToken: string
  requiredAmount: string
  paymentAmount: string
  startDate: Date | undefined
  endDate: Date | undefined
  requireAllPolls: boolean
  showLiveStats: boolean
  isTokenWeighted: boolean
  tokenWeight: string // For token weighting
  paymentTokenWeight: string // For payment weighting
  enableWhitelist: boolean
  whitelistAddresses: string[]
  whitelistWeights: { [address: string]: number }
  whitelistWeightsEnabled: boolean
  enableWeightedPayment: boolean
}

type ValidationErrors = {
  title?: string
  description?: string
  polls?: {
    [key: string]: {
      title?: string
      options?: string
      optionTexts?: string[]
      maxSelections?: string
    }
  }
  votingSettings?: {
    dates?: string
    token?: string
    amount?: string
    weightedPayment?: string
  }
  environment?: string
}

// Sortable Poll Item component
const SortablePollItem = ({ poll, index, activePollIndex, setActivePollIndex, removePoll, pollsLength }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: poll.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.8 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="flex items-center touch-manipulation"
    >
      <div className="flex items-center flex-1">
        <div 
          className="cursor-grab active:cursor-grabbing p-1 mr-1 rounded hover:bg-muted"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>
        <Button
          variant={activePollIndex === index ? "secondary" : "ghost"}
          size="sm"
          className={cn(
            "w-full justify-start text-left h-8 text-xs transition-all",
            activePollIndex === index && "bg-muted",
          )}
          onClick={() => setActivePollIndex(index)}
        >
          <span className="w-5 h-5 flex items-center justify-center rounded-full bg-muted-foreground/10 text-xs mr-2">
            {index + 1}
          </span>
          {poll.title
            ? poll.title.length > 20
              ? poll.title.substring(0, 20) + "..."
              : poll.title
            : `Poll ${index + 1}`}
        </Button>
      </div>
      {pollsLength > 1 && (
        <Button
          variant="ghost"
          size="sm"
          className="h-8 w-8 p-0 ml-1 text-muted-foreground hover:text-destructive transition-colors"
          onClick={() => removePoll(index)}
        >
          <X className="h-3.5 w-3.5" />
          <span className="sr-only">Remove poll</span>
        </Button>
      )}
    </div>
  );
};

export default function CreateVotePage() {
  const router = useRouter()
  const wallet = useWallet()
  const { loading, error, executeTransaction } = useSuiVote()

  // Media is now handled directly in each option component

  const [voteTitle, setVoteTitle] = useState("")
  const [voteDescription, setVoteDescription] = useState("")
  const [polls, setPolls] = useState<PollType[]>([
    {
      id: "poll-1",
      title: "",
      description: "",
      options: [
        { id: "option-1-1", text: "", mediaUrl: null },
        { id: "option-1-2", text: "", mediaUrl: null },
      ],
      isMultiSelect: false,
      maxSelections: 1,
      isRequired: true,
    },
  ])

  const tenMinutesFromNow = new Date(new Date().getTime() + 10 * 60 * 1000);
  const [startDate, setStartDate] = useState(tenMinutesFromNow);
  const [endDate, setEndDate] = useState(
    new Date(tenMinutesFromNow.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days after start date
  );

  const [votingSettings, setVotingSettings] = useState<VotingSettings>({
    requiredToken: "none",
    requiredAmount: "",
    paymentAmount: "0",
    startDate: tenMinutesFromNow,
    endDate: new Date(tenMinutesFromNow.getTime() + 7 * 24 * 60 * 60 * 1000),
    requireAllPolls: true,
    showLiveStats: false,
    isTokenWeighted: false,
    tokenWeight: "1", // For token weighting
    paymentTokenWeight: "0.1", // For payment weighting
    enableWhitelist: false,
    whitelistAddresses: [],
    whitelistWeights: {},
    whitelistWeightsEnabled: false,
    enableWeightedPayment: false
  });

  const [errors, setErrors] = useState<ValidationErrors>({})
  
  // State to preserve values when inputs are disabled
  const [preservedValues, setPreservedValues] = useState({
    paymentTokenWeight: "0.1",
    tokenWeight: "1",
    paymentAmount: ""
  })
  const [touchedFields, setTouchedFields] = useState<{
    title?: boolean
    description?: boolean
    polls?: { [key: string]: {
      title?: boolean
      options?: boolean
      optionTexts?: boolean[]
      maxSelections?: boolean
    }}
    votingSettings?: {
      dates?: boolean
      token?: boolean
      amount?: boolean
      weightedPayment?: boolean
    }
  }>({})
  const [attemptedSubmit, setAttemptedSubmit] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [activeTab, setActiveTab] = useState("details")
  const [activePollIndex, setActivePollIndex] = useState(0)
  const [showLiveStats, setShowLiveStats] = useState(false)
  const [transactionError, setTransactionError] = useState<string | null>(null)

  // New state for transaction status tracking
  const [txStatus, setTxStatus] = useState<TransactionStatus>(TransactionStatus.IDLE)
  const [txDigest, setTxDigest] = useState<string | null>(null)
  const [txStatusDialogOpen, setTxStatusDialogOpen] = useState(false)
  const [txProgress, setTxProgress] = useState(0)
  const [failedStep, setFailedStep] = useState<TransactionStatus | undefined>(undefined)

  // New state for environment variable checks
  const [envVarsChecked, setEnvVarsChecked] = useState(false)
  const [missingEnvVars, setMissingEnvVars] = useState<string[]>([])
  
  // New state for drag and drop
  const [activeId, setActiveId] = useState(null)
  
  // State to track if form data has been loaded from localStorage
  const [formDataLoaded, setFormDataLoaded] = useState(false)

  // Example available dates (next 14 days)
  const availableDates = Array.from({ length: 14 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return date;
  });
  
  // Set up sensors for drag and drop
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8, // 8px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Handle drag start event
  const handleDragStart = (event) => {
    setActiveId(event.active.id);
  };

  // Handle drag end event
  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (active.id !== over?.id) {
      setPolls((polls) => {
        const oldIndex = polls.findIndex((poll) => poll.id === active.id);
        const newIndex = polls.findIndex((poll) => poll.id === over.id);
        
        // Update activePollIndex if the active poll is being moved
        if (activePollIndex === oldIndex) {
          setActivePollIndex(newIndex);
        } else if (activePollIndex === newIndex) {
          setActivePollIndex(oldIndex);
        }
        
        return arrayMove(polls, oldIndex, newIndex);
      });
    }
    
    setActiveId(null);
  };

  // Example disabled dates
  const disabledDates = [
    new Date(new Date().setDate(new Date().getDate() + 3))
  ]

  // Function to save form data to localStorage
  const saveFormData = () => {
    if (typeof window !== 'undefined') {
      try {
        // Create a deep copy of the data to avoid modifying the original state
        const formData = {
          voteTitle,
          voteDescription,
          polls: JSON.parse(JSON.stringify(polls)), // Deep clone to avoid reference issues
          votingSettings: {...votingSettings}, // Shallow clone is fine for first level
          activeTab,
          activePollIndex,
          showLiveStats
        }
        
        // Dates are automatically stringified in JSON.stringify
        // No need for special handling here as we handle it during load
        
        localStorage.setItem('voteFormData', JSON.stringify(formData))

      } catch (error) {
        console.error('Error saving form data:', error)
      }
    }
  }

  // Function to load form data from localStorage
  const loadFormData = () => {
    // Only load if we haven't loaded before and we're in a browser environment
    if (typeof window !== 'undefined' && !formDataLoaded) {
      const savedData = localStorage.getItem('voteFormData')

      
      if (savedData) {
        try {
          const parsedData = JSON.parse(savedData)

          
          // Check if there's any meaningful data to restore
          const hasTitle = parsedData.voteTitle && parsedData.voteTitle.trim() !== ''
          const hasDescription = parsedData.voteDescription && parsedData.voteDescription.trim() !== ''
          const hasPolls = parsedData.polls && parsedData.polls.length > 0
          const hasPollTitles = hasPolls && parsedData.polls.some(poll => poll.title && poll.title.trim() !== '')
          const hasPollOptions = hasPolls && parsedData.polls.some(poll => 
            poll.options && poll.options.some(option => option.text && option.text.trim() !== '')
          )
          

          
          // More lenient check - restore if there's ANY meaningful data
          const hasMeaningfulData = hasTitle || hasDescription || hasPollTitles || hasPollOptions
          
          if (!parsedData || !hasMeaningfulData) {

            setFormDataLoaded(true) // Mark as loaded anyway to prevent future load attempts
            return
          }
          
          // Set form data from localStorage in a batch to prevent partial updates
          const updates = () => {
            // Set basic text fields
            setVoteTitle(parsedData.voteTitle || '')
            setVoteDescription(parsedData.voteDescription || '')
            
            // Handle dates properly by converting strings back to Date objects
            if (parsedData.votingSettings) {
              const settings = {...parsedData.votingSettings}
              
              // Ensure dates are properly converted to Date objects
              if (settings.startDate) {
                settings.startDate = new Date(settings.startDate)
                // Validate the date is not invalid
                if (isNaN(settings.startDate.getTime())) {
                  const tenMinutesFromNow = new Date(new Date().getTime() + 10 * 60 * 1000)
                  settings.startDate = tenMinutesFromNow
                }
              }
              
              if (settings.endDate) {
                settings.endDate = new Date(settings.endDate)
                // Validate the date is not invalid
                if (isNaN(settings.endDate.getTime())) {
                  const oneWeekFromStart = settings.startDate ? 
                    new Date(settings.startDate.getTime() + 7 * 24 * 60 * 60 * 1000) :
                    new Date(new Date().getTime() + 7 * 24 * 60 * 60 * 1000)
                  settings.endDate = oneWeekFromStart
                }
              }
              
              setVotingSettings(settings)
            }
            
            // Set polls if they exist and are valid
            if (parsedData.polls && Array.isArray(parsedData.polls) && parsedData.polls.length > 0) {
              setPolls(parsedData.polls)
            }
            
            // Set UI state
            setActiveTab(parsedData.activeTab || 'details')
            setActivePollIndex(parsedData.activePollIndex || 0)
            setShowLiveStats(parsedData.showLiveStats || false)
          }
          
          // Apply all updates at once
          updates()
          
          // Mark as loaded to prevent future load attempts and enable saving
          setFormDataLoaded(true)
          
          // Create a summary of what was loaded
          const loadedItems = [];
          if (hasTitle) loadedItems.push('title');
          if (hasDescription) loadedItems.push('description');
          if (hasPollTitles) {
            const pollCount = parsedData.polls.filter(poll => poll.title && poll.title.trim() !== '').length
            loadedItems.push(`${pollCount} poll${pollCount > 1 ? 's' : ''}`);
          }
          
          // Format the date if available
          let dateInfo = '';
          if (parsedData.votingSettings?.startDate) {
            const date = new Date(parsedData.votingSettings.startDate);
            if (!isNaN(date.getTime())) {
              dateInfo = ` (last edited ${date.toLocaleDateString()})`;
            }
          }
          

          
          // Use a small delay to ensure the toast system is ready
          setTimeout(() => {
            toast.success('Form data restored', {
              description: `Loaded ${loadedItems.join(', ')}${dateInfo}`,
              icon: <Clock className="h-4 w-4" />,
              duration: 5000
            })

          }, 100)
        } catch (error) {
          console.error('Error loading saved form data:', error)
          toast.error('Error loading saved data', {
            description: 'Could not restore your previous progress',
            icon: <AlertCircle className="h-4 w-4" />,
            duration: 5000
          })
          setFormDataLoaded(true) // Mark as loaded anyway to prevent future load attempts
        }
      } else {
        // No saved data found, just mark as loaded
        setFormDataLoaded(true)
      }
    }
  }
  
  // Function to clear saved form data and reset the form
  const clearSavedData = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('voteFormData')
      
      // Reset form to initial state
      setVoteTitle('')
      setVoteDescription('')
      setPolls([
        {
          id: "poll-1",
          title: "",
          description: "",
          options: [
            { id: "option-1-1", text: "", mediaUrl: null },
            { id: "option-1-2", text: "", mediaUrl: null },
          ],
          isMultiSelect: false,
          maxSelections: 1,
          isRequired: true,
        },
      ])
      
      const tenMinutesFromNow = new Date(new Date().getTime() + 10 * 60 * 1000);
      setVotingSettings({
        requiredToken: "none",
        requiredAmount: "",
        paymentAmount: "0",
        startDate: tenMinutesFromNow,
        endDate: new Date(tenMinutesFromNow.getTime() + 7 * 24 * 60 * 60 * 1000),
        requireAllPolls: true,
        showLiveStats: false,
        isTokenWeighted: false,
        tokenWeight: "1",
        enableWhitelist: false,
        whitelistAddresses: [],
        whitelistWeights: {},
        whitelistWeightsEnabled: false,
        enableWeightedPayment: false
      })
      
      setActiveTab('details')
      setActivePollIndex(0)
      setShowLiveStats(false)
      
      toast.success('Form reset', {
        description: 'All saved data has been cleared',
        icon: <Trash2 className="h-4 w-4" />,
        duration: 3000
      })
    }
  }

  // Debug function to check saved data (can be called from browser console)
  const checkSavedData = () => {
    if (typeof window !== 'undefined') {
      const savedData = localStorage.getItem('voteFormData')

      if (savedData) {
        try {
          const parsed = JSON.parse(savedData)

          return parsed
        } catch (e) {
          console.error('Error parsing saved data:', e)
        }
      }
      return null
    }
  }

  // Make debug function available globally for testing
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.checkSavedData = checkSavedData
      window.loadFormData = loadFormData
    }
  }, [])

  // Load form data from localStorage on component mount
  // This needs to run before any other effects that might set initial state
  useEffect(() => {
    // Longer timeout to ensure component is fully mounted and toast system is ready
    const timer = setTimeout(() => {

      loadFormData()
    }, 250) // Increased from 0 to 250ms
    
    return () => clearTimeout(timer)
  }, [])

  // Save form data to localStorage whenever relevant state changes
  useEffect(() => {
    // Only save if form data has been loaded (prevents overwriting with empty state)
    if (formDataLoaded) {
      // Use a debounce to prevent excessive saves
      const saveTimer = setTimeout(() => {
        saveFormData()
      }, 500) // 500ms debounce
      
      return () => clearTimeout(saveTimer)
    }
  }, [voteTitle, voteDescription, polls, votingSettings, activeTab, activePollIndex, showLiveStats])

  // Check environment variables on component mount
  useEffect(() => {
    const requiredEnvVars = [
      { name: "PACKAGE_ID", value: SUI_CONFIG.PACKAGE_ID },
      { name: "ADMIN_ID", value: SUI_CONFIG.ADMIN_ID },
      { name: "NETWORK", value: SUI_CONFIG.NETWORK },
    ]

    const missing = requiredEnvVars
      .filter(
        (env) =>
          !env.value || env.value === "YOUR_PACKAGE_ID_HERE" || env.value === "ADMIN_OBJECT_ID_FROM_PUBLISH_OUTPUT",
      )
      .map((env) => env.name)

    setMissingEnvVars(missing)
    setEnvVarsChecked(true)

    if (missing.length > 0) {
      setErrors((prev) => ({
        ...prev,
        environment: `Missing required configuration: ${missing.join(", ")}`,
      }))

      // Use consistent Sonner toast
      toast.error('Configuration Error', {
        description: `Missing required configuration: ${missing.join(", ")}`,
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 10000 // Longer duration for important errors
      })
    }
  }, [])

  // Update document title when vote title changes
  useEffect(() => {
    document.title = voteTitle ? `${voteTitle} - SuiVote` : "Create New Vote - SuiVote"
  }, [voteTitle])

  // Display error from hook if it exists
  useEffect(() => {
    if (error) {
      setTransactionError(error)
      setTxStatus(TransactionStatus.ERROR)

      toast.error("Error creating vote", {
        description: error,
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 10000
      })
      console.error("Transaction error:", error)
    }
  }, [error])

  // Check wallet connection status
  useEffect(() => {
    if (activeTab === "settings" && !wallet.connected) {
      toast.error('Wallet not connected', {
        description: 'Please connect your wallet to create a vote',
        icon: <Wallet className="h-4 w-4" />,
        duration: 5000
      })
    }
  }, [activeTab, wallet.connected])

  // Update progress bar based on transaction status
  useEffect(() => {
    switch (txStatus) {
      case TransactionStatus.IDLE:
        setTxProgress(0)
        break
      case TransactionStatus.BUILDING:
        setTxProgress(20)
        break
      case TransactionStatus.SIGNING:
        setTxProgress(40)
        break
      case TransactionStatus.EXECUTING:
        setTxProgress(60)
        break
      case TransactionStatus.CONFIRMING:
        setTxProgress(80)
        break
      case TransactionStatus.SUCCESS:
        setTxProgress(100)
        break
      case TransactionStatus.ERROR:
        // Keep the progress where it was when the error occurred
        break
    }
  }, [txStatus])

  // Update the addPoll function to use timestamp-based unique ID
// 3. Add poll with better ordering
const addPoll = () => {
  const timestamp = Date.now()
  const pollNumber = polls.length + 1 // Ensure sequential numbering
  const newPoll: PollType = {
    id: `poll-${timestamp}`,
    title: ``, 
    description: "",
    options: [
      { id: `option-${timestamp}-1`, text: "", mediaUrl: null },
      { id: `option-${timestamp}-2`, text: "", mediaUrl: null },
    ],
    isMultiSelect: false,
    maxSelections: 1,
    isRequired: true,
  }
  setPolls([...polls, newPoll])
  setActivePollIndex(polls.length) // Set to the newly added poll
  setActiveTab("polls")
}

  const removePoll = (pollIndex: number) => {
    if (polls.length > 1) {
      const newPolls = [...polls]
      newPolls.splice(pollIndex, 1)
      setPolls(newPolls)
      
      // Fixed: Better logic for active poll index after removal
      if (activePollIndex === pollIndex) {
        // If removing the currently active poll
        if (pollIndex === polls.length - 1) {
          // If removing the last poll, go to the previous one
          setActivePollIndex(Math.max(0, pollIndex - 1))
        } else {
          // Otherwise, keep the same index (which now points to the next poll)
          setActivePollIndex(pollIndex)
        }
      } else if (activePollIndex > pollIndex) {
        // If removing a poll before the active one, decrement active index
        setActivePollIndex(activePollIndex - 1)
      }
      // If removing a poll after the active one, keep active index unchanged
    }
  }

  const updatePollTitle = (pollIndex: number, title: string) => {
    const newPolls = [...polls]
    newPolls[pollIndex].title = title
    setPolls(newPolls)
    // Mark poll title as touched
    setTouchedFields(prev => ({
      ...prev,
      polls: {
        ...prev.polls,
        [newPolls[pollIndex].id]: {
          ...prev.polls?.[newPolls[pollIndex].id],
          title: true
        }
      }
    }))
    // Validate with smart validation
    setTimeout(() => validateForm(false), 100);
  }

  const updatePollDescription = (pollIndex: number, description: string) => {
    const newPolls = [...polls]
    newPolls[pollIndex].description = description
    setPolls(newPolls)
    // No validation needed for optional description
  }

  const updatePollType = (pollIndex: number, isMultiSelect: boolean) => {
    const newPolls = [...polls]
    newPolls[pollIndex].isMultiSelect = isMultiSelect
    newPolls[pollIndex].maxSelections = isMultiSelect ? Math.min(2, newPolls[pollIndex].options.length - 1) : 1
    setPolls(newPolls)
    // Validate form without navigation to update errors in real-time
    setTimeout(() => validateForm(false), 0);
  }

  const updateMaxSelections = (pollIndex: number, maxSelections: number) => {
    const newPolls = [...polls]
    newPolls[pollIndex].maxSelections = maxSelections
    setPolls(newPolls)
    // Validate form without navigation to update errors in real-time
    setTimeout(() => validateForm(false), 0);
  }

  const updatePollRequired = (pollIndex: number, isRequired: boolean) => {
    const newPolls = [...polls]
    newPolls[pollIndex].isRequired = isRequired
    setPolls(newPolls)
    
    // If no polls are required anymore, turn off requireAllPolls
    if (!isRequired && !newPolls.some(poll => poll.isRequired)) {
      setVotingSettings({ ...votingSettings, requireAllPolls: false })
    }
    
    // Validate form without navigation to update errors in real-time
    setTimeout(() => validateForm(false), 0);
  }

  // Helper function to check if any polls are required
  const hasRequiredPolls = () => {
    return polls.some(poll => poll.isRequired)
  }

  // Update the addOption function to use timestamp-based unique IDs
  const addOption = (pollIndex: number) => {
    const newPolls = [...polls]
    const currentOptions = newPolls[pollIndex].options
    const optionNumber = currentOptions.length + 1
    
    // Use sequential numbering instead of timestamp for better ordering
    const newOptionId = `poll-${pollIndex}-option-${optionNumber}-${Date.now()}`
    
    const newOption = { 
      id: newOptionId, 
      text: "", 
      mediaUrl: null,
      fileId: null // Add fileId tracking
    }
    
    newPolls[pollIndex].options.push(newOption)
    
    // Adjust maxSelections if needed for multi-select polls
    if (newPolls[pollIndex].isMultiSelect) {
      const maxPossible = newPolls[pollIndex].options.length - 1
      if (newPolls[pollIndex].maxSelections >= maxPossible) {
        newPolls[pollIndex].maxSelections = maxPossible
      }
    }
    

    setPolls(newPolls)
    
    // Clear any existing errors for this poll when adding options (better UX)
    if (errors.polls?.[newPolls[pollIndex].id]) {
      const newErrors = { ...errors }
      if (newErrors.polls) {
        delete newErrors.polls[newPolls[pollIndex].id]
        if (Object.keys(newErrors.polls).length === 0) {
          delete newErrors.polls
        }
      }
      setErrors(newErrors)
    }
  }

  const removeOption = (pollIndex: number, optionIndex: number) => {
    const newPolls = [...polls]
    const currentOptions = newPolls[pollIndex].options
    
    if (currentOptions.length > 2) {

      
      // Remove the option at the specified index
      newPolls[pollIndex].options.splice(optionIndex, 1)
  
      // Adjust maxSelections if needed for multi-select polls
      if (newPolls[pollIndex].isMultiSelect) {
        const newMaxPossible = newPolls[pollIndex].options.length - 1
        if (newPolls[pollIndex].maxSelections > newMaxPossible) {
          newPolls[pollIndex].maxSelections = newMaxPossible
        }
      }
  
      setPolls(newPolls)
      

      
      // Update touched fields to remove the deleted option
      setTouchedFields(prev => {
        if (prev.polls?.[newPolls[pollIndex].id]?.optionTexts) {
          const newTouched = { ...prev }
          const pollTouched = { ...newTouched.polls![newPolls[pollIndex].id] }
          if (pollTouched.optionTexts) {
            pollTouched.optionTexts.splice(optionIndex, 1)
          }
          newTouched.polls![newPolls[pollIndex].id] = pollTouched
          return newTouched
        }
        return prev
      })
    }
  }

  const updateOption = (pollIndex: number, optionIndex: number, text: string) => {
    const newPolls = [...polls]
    
    // Validate indices
    if (pollIndex >= 0 && pollIndex < newPolls.length &&
        optionIndex >= 0 && optionIndex < newPolls[pollIndex].options.length) {
      
      newPolls[pollIndex].options[optionIndex].text = text

      setPolls(newPolls)
      
      // Mark this option as touched
      setTouchedFields(prev => {
        const newTouched = { ...prev }
        if (!newTouched.polls) newTouched.polls = {}
        if (!newTouched.polls[newPolls[pollIndex].id]) {
          newTouched.polls[newPolls[pollIndex].id] = {}
        }
        if (!newTouched.polls[newPolls[pollIndex].id].optionTexts) {
          newTouched.polls[newPolls[pollIndex].id].optionTexts = []
        }
        newTouched.polls[newPolls[pollIndex].id].optionTexts![optionIndex] = true
        return newTouched
      })
      
      // Validate only this specific field
      setTimeout(() => validateForm(false), 100);
    } else {
      console.error(`Invalid indices: poll ${pollIndex}, option ${optionIndex}`)
    }
  }

  // Enhanced validation function aligned with service validation
  // Function to check if a section is complete
  const isSectionComplete = (section: string): boolean => {
    switch (section) {
      case "details":
        return voteTitle.trim().length > 0
      case "polls":
        return polls.every(poll =>
          poll.title.trim().length > 0 &&
          poll.options.length >= 2 &&
          poll.options.every(option => option.text.trim().length > 0)
        )
      case "settings":
        const hasValidDates = votingSettings.startDate && votingSettings.endDate &&
          isAfter(votingSettings.endDate, votingSettings.startDate)

        const hasValidToken = votingSettings.requiredToken === "none" ||
          (votingSettings.requiredToken !== "none" &&
            votingSettings.requiredAmount &&
            Number.parseFloat(votingSettings.requiredAmount) > 0)

        const hasValidPayment = !votingSettings.paymentAmount ||
          Number.parseFloat(votingSettings.paymentAmount) >= 0

        return hasValidDates && hasValidToken && hasValidPayment && wallet.connected
      default:
        return true
    }
  }

  // Function to handle tab changes with validation
  const handleTabChange = (value: string) => {
    // If current tab is details and there's no title, prevent any navigation
    if (activeTab === "details" && !voteTitle.trim()) {
      // Show specific error for missing title
      setErrors((prev) => ({
        ...prev,
        title: "Vote title is required"
      }))
      return
    }
    
    // Validate the form to update errors
    validateForm(false)

    // Check if current section is complete before allowing navigation
    if (isSectionComplete(activeTab)) {
      setActiveTab(value)
    } else {
      // Validate the current section to show errors
      validateForm()

      // Show toast notification with Sonner
      toast.error("Please complete the current section", {
        description: "Fix all errors before proceeding to the next section",
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 5000
      })
    }
  }

  // 4. Enhanced poll validation before submission
const validatePollOrder = (): boolean => {
  // Ensure polls are properly ordered and complete
  for (let i = 0; i < polls.length; i++) {
    const poll = polls[i]
    
    // Check if poll has required fields
    if (!poll.title.trim()) {
      console.error(`Poll ${i + 1} is missing a title`)
      return false
    }
    
    // Check if poll has minimum options
    if (poll.options.length < 2) {
      console.error(`Poll ${i + 1} needs at least 2 options`)
      return false
    }
    
    // Check if all options have text
    for (let j = 0; j < poll.options.length; j++) {
      if (!poll.options[j].text.trim()) {
        console.error(`Poll ${i + 1}, Option ${j + 1} is missing text`)
        return false
      }
    }
  }
  return true
}

// 5. Fixed poll data preparation for submission
const preparePollDataForSubmission = () => {
  // Ensure polls are processed in the correct order
  return polls.map((poll, pollIndex) => {
    
    return {
      title: poll.title.trim(),
      description: poll.description.trim(),
      isMultiSelect: poll.isMultiSelect,
      maxSelections: poll.maxSelections,
      isRequired: poll.isRequired,
      options: poll.options.map((option, optionIndex) => {
        return {
          text: option.text.trim(),
          mediaUrl: option.mediaUrl || undefined,
          fileId: option.fileId || undefined
        }
      })
    }
  })
}


  const validateFormWithSettings = (navigateToErrors: boolean = true, customVotingSettings?: VotingSettings, forceValidation: boolean = false): boolean => {
    const settingsToUse = customVotingSettings || votingSettings
    return validateFormInternal(navigateToErrors, forceValidation, settingsToUse)
  }

  const validateForm = (navigateToErrors: boolean = true, forceValidation: boolean = false): boolean => {
    return validateFormInternal(navigateToErrors, forceValidation, votingSettings)
  }

  const validateFormInternal = (navigateToErrors: boolean = true, forceValidation: boolean = false, settingsToUse: VotingSettings): boolean => {
    const newErrors: ValidationErrors = {}
    let errorTab: string | null = null

    // Check for environment variable errors first
    if (missingEnvVars.length > 0) {
      newErrors.environment = `Missing required configuration: ${missingEnvVars.join(", ")}`
      toast.error('Configuration Error', {
        description: `Missing required configuration: ${missingEnvVars.join(", ")}`,
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 10000
      })
      return false
    }

    // Enhanced vote title validation
    if (!voteTitle.trim() && (touchedFields.title || forceValidation || attemptedSubmit)) {
      newErrors.title = "Vote title is required"
      errorTab = "details"
    } else if (voteTitle.trim() && voteTitle.trim().length < 3) {
      newErrors.title = "Vote title must be at least 3 characters long"
      errorTab = "details"
    } else if (voteTitle.trim() && voteTitle.trim().length > 100) {
      newErrors.title = "Vote title must be less than 100 characters"
      errorTab = "details"
    }

    // Enhanced vote description validation (optional)
    if (voteDescription.trim() && voteDescription.trim().length < 10) {
      newErrors.description = "Vote description must be at least 10 characters long"
      errorTab = "details"
    } else if (voteDescription.trim() && voteDescription.trim().length > 1000) {
      newErrors.description = "Vote description must be less than 1000 characters"
      errorTab = "details"
    }

    // Enhanced poll validation
    const pollErrors: ValidationErrors["polls"] = {}

    // Check if we have at least one poll
    if (polls.length === 0 && (forceValidation || attemptedSubmit)) {
      newErrors.polls = { general: "At least one poll is required" }
      errorTab = "polls"
    }

    polls.forEach((poll, index) => {
      const pollError: {
        title?: string
        options?: string
        optionTexts?: string[]
        maxSelections?: string
      } = {}

      const pollTouched = touchedFields.polls?.[poll.id]
      const shouldValidatePoll = forceValidation || attemptedSubmit || pollTouched?.title || pollTouched?.options

      // Enhanced poll title validation
      if (!poll.title.trim() && (pollTouched?.title || forceValidation || attemptedSubmit)) {
        pollError.title = "Poll title is required"
        errorTab = "polls"
      } else if (poll.title.trim() && poll.title.trim().length < 3) {
        pollError.title = "Poll title must be at least 3 characters long"
        errorTab = "polls"
      } else if (poll.title.trim() && poll.title.trim().length > 200) {
        pollError.title = "Poll title must be less than 200 characters"
        errorTab = "polls"
      }

      // Enhanced option validation
      const emptyOptions = poll.options.filter((option) => !option.text.trim())
      const validOptions = poll.options.filter((option) => option.text.trim())
      
      if (emptyOptions.length > 0 && shouldValidatePoll) {
        pollError.options = `${emptyOptions.length} option(s) need text`
        pollError.optionTexts = poll.options.map((option, optIndex) => {
          const optionTouched = pollTouched?.optionTexts?.[optIndex]
          if (!option.text.trim() && (optionTouched || forceValidation || attemptedSubmit)) {
            return "Option text is required"
          } else if (option.text.trim() && option.text.trim().length > 100) {
            return "Option text must be less than 100 characters"
          }
          return ""
        })
        errorTab = "polls"
      }

      // Check minimum number of valid options
      if (validOptions.length < 2 && shouldValidatePoll) {
        pollError.options = `Poll needs at least 2 valid options (currently has ${validOptions.length})`
        errorTab = "polls"
      }

      // Enhanced maxSelections validation for multi-select polls
      if (poll.isMultiSelect && (pollTouched?.maxSelections || forceValidation || attemptedSubmit)) {
        if (poll.maxSelections < 1) {
          pollError.maxSelections = "Maximum selections must be at least 1"
          errorTab = "polls"
        } else if (poll.maxSelections >= validOptions.length && validOptions.length >= 2) {
          pollError.maxSelections = `Maximum selections must be less than the number of valid options (${validOptions.length})`
          errorTab = "polls"
        }
      }

      // Enhanced duplicate option detection
      const optionTexts = new Set()
      const duplicateIndices: number[] = []
      let hasDuplicateOptions = false

      poll.options.forEach((option, optIndex) => {
        const trimmedText = option.text.trim().toLowerCase()
        if (trimmedText && optionTexts.has(trimmedText)) {
          hasDuplicateOptions = true
          duplicateIndices.push(optIndex)
        }
        if (trimmedText) {
          optionTexts.add(trimmedText)
        }
      })

      if (hasDuplicateOptions && shouldValidatePoll) {
        pollError.options = "All poll options must be unique (case-insensitive)"
        if (!pollError.optionTexts) {
          pollError.optionTexts = poll.options.map(() => "")
        }
        duplicateIndices.forEach(index => {
          if (pollError.optionTexts) {
            pollError.optionTexts[index] = "Duplicate option text"
          }
        })
        errorTab = "polls"
      }

      if (Object.keys(pollError).length > 0) {
        pollErrors[poll.id] = pollError
      }
    })

    if (Object.keys(pollErrors).length > 0) {
      newErrors.polls = pollErrors
    }

    // Enhanced voting settings validation
    const settingsErrors: { 
      dates?: string; 
      token?: string; 
      amount?: string; 
      weightedPayment?: string;
      tokenWeight?: string;
      paymentTokenWeight?: string;
      whitelist?: string;
    } = {}
    const settingsTouched = touchedFields.votingSettings

    // Enhanced date validation
    if (settingsTouched?.dates || forceValidation || attemptedSubmit) {
      if (!settingsToUse.startDate || !settingsToUse.endDate) {
        settingsErrors.dates = "Both start and end dates are required"
        errorTab = "settings"
      } else {
        const now = new Date()
        const minStartTime = new Date(now.getTime() + 5 * 60 * 1000) // 5 minutes from now
        const maxEndTime = new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000) // 1 year from now
        const minDuration = 10 * 60 * 1000 // 10 minutes minimum duration
        const maxDuration = 90 * 24 * 60 * 60 * 1000 // 90 days maximum duration

        if (settingsToUse.startDate < minStartTime) {
          settingsErrors.dates = "Start date must be at least 5 minutes in the future"
          errorTab = "settings"
        } else if (settingsToUse.endDate > maxEndTime) {
          settingsErrors.dates = "End date cannot be more than 1 year in the future"
          errorTab = "settings"
        } else if (!isAfter(settingsToUse.endDate, settingsToUse.startDate)) {
          settingsErrors.dates = "End date must be after start date"
          errorTab = "settings"
        } else {
          const duration = settingsToUse.endDate.getTime() - settingsToUse.startDate.getTime()
          if (duration < minDuration) {
            settingsErrors.dates = "Voting period must be at least 10 minutes long"
            errorTab = "settings"
          } else if (duration > maxDuration) {
            settingsErrors.dates = "Voting period cannot exceed 90 days"
            errorTab = "settings"
          }
        }
      }
    }

    // Enhanced token requirements validation
    if ((settingsTouched?.token || forceValidation || attemptedSubmit) && settingsToUse.requiredToken && settingsToUse.requiredToken !== "none") {
      if (!settingsToUse.requiredAmount || settingsToUse.requiredAmount.trim() === "") {
        settingsErrors.token = "Token amount is required when a token is selected"
        errorTab = "settings"
      } else {
        const amount = Number.parseFloat(settingsToUse.requiredAmount)
        if (isNaN(amount) || amount <= 0) {
          settingsErrors.token = "Token amount must be a valid number greater than 0"
          errorTab = "settings"
        } else if (amount > 1000000) {
          settingsErrors.token = "Token amount seems unusually high (max: 1,000,000)"
          errorTab = "settings"
        }
      }
    }

    // Enhanced payment amount validation
    if (settingsTouched?.amount || forceValidation || attemptedSubmit) {
      if (settingsToUse.paymentAmount && settingsToUse.paymentAmount.trim() !== "") {
        const amount = Number.parseFloat(settingsToUse.paymentAmount)
        if (isNaN(amount)) {
          settingsErrors.amount = "Payment amount must be a valid number"
          errorTab = "settings"
        } else if (amount < 0) {
          settingsErrors.amount = "Payment amount cannot be negative"
          errorTab = "settings"
        } else if (amount > 1000) {
          settingsErrors.amount = "Payment amount seems unusually high (max: 1,000 SUI)"
          errorTab = "settings"
        }
      }
    }

    // Enhanced token weight validation (for token requirements)
    if (settingsToUse.isTokenWeighted && settingsToUse.requiredToken !== "none" && !settingsToUse.enableWeightedPayment && !settingsToUse.whitelistWeightsEnabled) {
      if ((settingsTouched?.tokenWeight || forceValidation || attemptedSubmit)) {
        if (!settingsToUse.tokenWeight || settingsToUse.tokenWeight.trim() === "") {
          settingsErrors.tokenWeight = "Tokens per vote is required when token weighting is enabled"
          errorTab = "settings"
        } else {
          const weight = Number.parseFloat(settingsToUse.tokenWeight)
          if (isNaN(weight) || weight <= 0) {
            settingsErrors.tokenWeight = "Tokens per vote must be a valid number greater than 0"
            errorTab = "settings"
          } else if (weight > 1000000) {
            settingsErrors.tokenWeight = "Tokens per vote seems unusually high (max: 1,000,000)"
            errorTab = "settings"
          }
        }
      }
    }

    // Enhanced weighted payment validation
    if ((settingsTouched?.weightedPayment || forceValidation || attemptedSubmit) && settingsToUse.enableWeightedPayment) {
      if (!settingsToUse.paymentTokenWeight || settingsToUse.paymentTokenWeight.trim() === "") {
        settingsErrors.paymentTokenWeight = `${settingsToUse.requiredToken !== "none" ? "Tokens" : "SUI"} per vote is required when weighted payment is enabled`
        errorTab = "settings"
      } else {
        const weight = Number.parseFloat(settingsToUse.paymentTokenWeight)
        if (isNaN(weight) || weight <= 0) {
          settingsErrors.paymentTokenWeight = `${settingsToUse.requiredToken !== "none" ? "Tokens" : "SUI"} per vote must be a valid number greater than 0`
          errorTab = "settings"
        } else if (settingsToUse.requiredToken === "none" && weight < 0.001) {
          settingsErrors.paymentTokenWeight = "SUI per vote must be at least 0.001"
          errorTab = "settings"
        } else if (weight > 1000000) {
          settingsErrors.paymentTokenWeight = `${settingsToUse.requiredToken !== "none" ? "Tokens" : "SUI"} per vote seems unusually high (max: 1,000,000)`
          errorTab = "settings"
        }
      }
    }

    // Enhanced whitelist validation
    if (settingsToUse.enableWhitelist && (settingsTouched?.whitelist || forceValidation || attemptedSubmit)) {
      if (!settingsToUse.whitelistAddresses || settingsToUse.whitelistAddresses.length === 0) {
        settingsErrors.whitelist = "At least one address is required when whitelist is enabled"
        errorTab = "settings"
      } else if (settingsToUse.whitelistAddresses.length > 10000) {
        settingsErrors.whitelist = "Whitelist cannot exceed 10,000 addresses"
        errorTab = "settings"
      }
    }

    if (Object.keys(settingsErrors).length > 0) {
      newErrors.votingSettings = settingsErrors
    }

    // Check wallet connection
    if (!wallet.connected) {
      toast.error('Wallet not connected', {
        description: 'Please connect your wallet to create a vote',
        icon: <Wallet className="h-4 w-4" />,
        duration: 5000
      })
      return false
    }

    setErrors(newErrors)

    // If there are errors and we should navigate to them
    if (navigateToErrors && Object.keys(newErrors).length > 0 && errorTab) {
      setActiveTab(errorTab)

      // If the error is in a specific poll, navigate to that poll
      if (errorTab === "polls" && newErrors.polls) {
        const errorPollIndex = polls.findIndex((poll) => newErrors.polls?.[poll.id])
        if (errorPollIndex !== -1) {
          setActivePollIndex(errorPollIndex)
        }
      }

      // Auto-scroll to the first error field after tab switch
      setTimeout(() => {
        const firstErrorField = document.querySelector('.border-red-500, [data-error="true"]') as HTMLElement
        if (firstErrorField) {
          firstErrorField.scrollIntoView({ behavior: 'smooth', block: 'center' })
          firstErrorField.focus()
        }
      }, 100)

      return false
    }

    return Object.keys(newErrors).length === 0
  }

  const addMediaToOption = (mediaHandlers: any, pollIndex: number, optionIndex: number, file: File) => {
    try {

      
      // Validate file size (max 5MB)
      const maxSize = 5 * 1024 * 1024
      if (file.size > maxSize) {
        toast.error("File size exceeds the 5MB limit", {
          icon: <AlertCircle className="h-4 w-4" />
        })
        return
      }
  
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast.error("Only image files are supported", {
          icon: <AlertCircle className="h-4 w-4" />
        })
        return
      }
  
      // Validate indices
      if (pollIndex >= polls.length || optionIndex >= polls[pollIndex].options.length) {
        toast.error("Invalid poll or option index", {
          icon: <AlertCircle className="h-4 w-4" />
        })
        return
      }
  
      const newPolls = [...polls]
      
      // Show loading state
      newPolls[pollIndex].options[optionIndex].mediaUrl = 'loading'
      setPolls(newPolls)
  
      // Create FileReader for preview
      const reader = new FileReader()
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string
        if (dataUrl) {
          // Add file to media handler
          const fileId = mediaHandlers.addMediaFile(file)
  
          // Update the specific option with proper indexing
          const updatedPolls = [...polls]
          updatedPolls[pollIndex].options[optionIndex].mediaUrl = dataUrl
          updatedPolls[pollIndex].options[optionIndex].fileId = fileId
          
          setPolls(updatedPolls)
          toast.success(`Media added to option ${optionIndex + 1}`, {
            icon: <Check className="h-4 w-4" />
          })
          

        } else {
          // Reset on error
          const errorPolls = [...polls]
          errorPolls[pollIndex].options[optionIndex].mediaUrl = null
          setPolls(errorPolls)
          toast.error("Failed to generate preview", {
            icon: <AlertCircle className="h-4 w-4" />
          })
        }
      }
  
      reader.onerror = () => {
        const errorPolls = [...polls]
        errorPolls[pollIndex].options[optionIndex].mediaUrl = null
        setPolls(errorPolls)
        toast.error("Failed to read image file", {
          icon: <AlertCircle className="h-4 w-4" />
        })
      }
  
      reader.readAsDataURL(file)
    } catch (error) {
      console.error(`Error adding media to poll ${pollIndex + 1}, option ${optionIndex + 1}:`, error)
      toast.error("Failed to add media file", {
        icon: <AlertCircle className="h-4 w-4" />
      })
      
      // Reset on error
      const errorPolls = [...polls]
      errorPolls[pollIndex].options[optionIndex].mediaUrl = null
      setPolls(errorPolls)
    }
  }
  
  // 5. Fixed removeMediaFromOption function
  const removeMediaFromOption = (mediaHandlers: any, pollIndex: number, optionIndex: number) => {
    try {

      
      const newPolls = [...polls]
      const fileId = newPolls[pollIndex].options[optionIndex].fileId
  
      // Update UI immediately
      newPolls[pollIndex].options[optionIndex].mediaUrl = null
      newPolls[pollIndex].options[optionIndex].fileId = null
      setPolls(newPolls)
  
      // Remove from media handler if it exists
      if (fileId && mediaHandlers) {
        mediaHandlers.removeMediaFile(fileId)
        toast.success("Media removed successfully", {
          icon: <Check className="h-4 w-4" />
        })
      }
    } catch (error) {
      console.error(`Error removing media from poll ${pollIndex + 1}, option ${optionIndex + 1}:`, error)
      toast.error("Failed to remove media file", {
        icon: <AlertCircle className="h-4 w-4" />
      })
    }
  }

  // Enhanced form validation with better error handling
  const validateFormSection = (section: string) => {
    const errors: any = {}
    
    switch (section) {
      case 'details':
        if (!voteTitle.trim()) {
          errors.title = 'Vote title is required'
        } else if (voteTitle.length < 3) {
          errors.title = 'Vote title must be at least 3 characters'
        } else if (voteTitle.length > 100) {
          errors.title = 'Vote title must be less than 100 characters'
        }
        
        if (voteDescription.trim() && voteDescription.length < 10) {
          errors.description = 'Vote description must be at least 10 characters'
        } else if (voteDescription.length > 1000) {
          errors.description = 'Vote description must be less than 1000 characters'
        }
        break
        
      case 'polls':
        if (polls.length === 0) {
          errors.polls = 'At least one poll is required'
        }
        
        polls.forEach((poll, pollIndex) => {
          if (!poll.question.trim()) {
            errors[`poll_${pollIndex}_question`] = `Poll ${pollIndex + 1} question is required`
          }
          
          if (poll.options.length < 2) {
            errors[`poll_${pollIndex}_options`] = `Poll ${pollIndex + 1} must have at least 2 options`
          }
          
          poll.options.forEach((option, optionIndex) => {
            if (!option.text.trim()) {
              errors[`poll_${pollIndex}_option_${optionIndex}`] = `Option ${optionIndex + 1} text is required`
            }
          })
        })
        break
        
      case 'settings':
        if (!votingSettings.startDate) {
          errors.startDate = 'Start date is required'
        }
        
        if (!votingSettings.endDate) {
          errors.endDate = 'End date is required'
        }
        
        if (votingSettings.startDate && votingSettings.endDate) {
          if (votingSettings.endDate <= votingSettings.startDate) {
            errors.endDate = 'End date must be after start date'
          }
        }
        break
    }
    
    return errors
  }

  // Enhanced comprehensive form validation
  const validateCompleteForm = () => {
    const detailsErrors = validateFormSection('details')
    const pollsErrors = validateFormSection('polls')
    const settingsErrors = validateFormSection('settings')
    
    const allErrors = { ...detailsErrors, ...pollsErrors, ...settingsErrors }
    setValidationErrors(allErrors)
    
    return Object.keys(allErrors).length === 0
  }

  // Enhanced vote creation submission with comprehensive validation
  const handleSubmit = async (mediaHandlers: any) => {
    try {
      const now = new Date();
      let datesUpdated = false;
      
      // STEP 1: Pre-flight validation checks
      setSubmitting(true);
      setAttemptedSubmit(true);
      
      // Validate form completeness with force validation
      if (!validateForm(true, true)) {
        setSubmitting(false);
        return;
      }
      
      // Check for required fields with detailed feedback
      const missingFields = [];
      if (!voteTitle.trim()) missingFields.push('Vote title');
      if (polls.length === 0) missingFields.push('At least one poll');
      if (!votingSettings.startDate) missingFields.push('Start date');
      if (!votingSettings.endDate) missingFields.push('End date');
      
      if (missingFields.length > 0) {
        toast.error('Missing required fields', {
          description: `Please provide: ${missingFields.join(', ')}`,
          icon: <AlertCircle className="h-4 w-4" />,
          duration: 6000
        });
        setSubmitting(false);
        return;
      }
      
      // STEP 2: Validate poll structure and data
      const pollValidationErrors = [];
      polls.forEach((poll, index) => {
        if (!poll.title.trim()) {
          pollValidationErrors.push(`Poll ${index + 1}: Missing title`);
        }
        if (poll.options.length < 2) {
          pollValidationErrors.push(`Poll ${index + 1}: Needs at least 2 options`);
        }
        const emptyOptions = poll.options.filter(opt => !opt.text.trim()).length;
        if (emptyOptions > 0) {
          pollValidationErrors.push(`Poll ${index + 1}: ${emptyOptions} empty option(s)`);
        }
      });
      
      if (pollValidationErrors.length > 0) {
        toast.error('Poll validation failed', {
          description: pollValidationErrors.slice(0, 3).join('; ') + (pollValidationErrors.length > 3 ? '...' : ''),
          icon: <AlertCircle className="h-4 w-4" />,
          duration: 8000
        });
        setSubmitting(false);
        return;
      }
      
      // STEP 3: Date validation and auto-correction
      const minStartTime = new Date(now.getTime() + 5 * 60 * 1000); // 5 minutes from now
      
      if (!votingSettings.startDate || votingSettings.startDate < minStartTime) {
        const newStartDate = new Date(now.getTime() + 10 * 60 * 1000);
        setVotingSettings(prev => ({
          ...prev,
          startDate: newStartDate
        }));
        datesUpdated = true;

        // Auto-adjust end date if needed
        if (!votingSettings.endDate || !isAfter(votingSettings.endDate, newStartDate)) {
          const newEndDate = new Date(newStartDate.getTime() + 7 * 24 * 60 * 60 * 1000);
          setVotingSettings(prev => ({
            ...prev,
            endDate: newEndDate
          }));
        }
      }

      if (datesUpdated) {
        toast.info('Voting schedule adjusted', {
          description: 'Start time has been set to ensure proper blockchain processing time.',
          icon: <Clock className="h-4 w-4" />,
          duration: 4000
        });
      }

      // STEP 4: Wallet and network validation
      if (!wallet.connected) {
        toast.error('Wallet connection required', {
          description: 'Please connect your wallet to create and publish the vote',
          icon: <Wallet className="h-4 w-4" />,
          duration: 6000
        });
        setSubmitting(false);
        return;
      }

      // STEP 5: Initialize transaction process
      setTransactionError(null);
      setTxStatus(TransactionStatus.BUILDING);
      setTxStatusDialogOpen(true);
      setTxProgress(10);

      toast.info('Preparing vote transaction', {
        description: 'Building transaction data and validating parameters...',
        duration: 3000
      });

      // STEP 6: Prepare transaction data
      const whitelistAddressesToSend = votingSettings.enableWhitelist
        ? votingSettings.whitelistAddresses.filter(addr => addr.trim())
        : [];

      const pollData = polls.map((poll, index) => ({
        ...poll,
        order: index,
        options: poll.options.map((option, optIndex) => ({
          ...option,
          order: optIndex
        }))
      }));

      setTxProgress(30);
      setTxStatus(TransactionStatus.BUILDING);

      // STEP 7: Create transaction with media handling
      let transaction;
      try {
        transaction = await mediaHandlers.createVoteWithMedia({
          voteTitle: voteTitle.trim(),
          voteDescription: voteDescription.trim(),
          startDate: votingSettings.startDate,
          endDate: votingSettings.endDate,
          requiredToken: votingSettings.requiredToken !== "none" ? votingSettings.requiredToken : "",
          requiredAmount: votingSettings.requiredAmount || "0",
          paymentAmount: votingSettings.paymentAmount || "0",
          requireAllPolls: votingSettings.requireAllPolls,
          showLiveStats: votingSettings.showLiveStats || false,
          isTokenWeighted: votingSettings.isTokenWeighted && votingSettings.requiredToken !== "none",
          tokenWeight: votingSettings.isTokenWeighted ? votingSettings.tokenWeight : "1",
          enableWeightedPayment: votingSettings.enableWeightedPayment,
          paymentTokenWeight: votingSettings.enableWeightedPayment ? votingSettings.paymentTokenWeight : "0.1",
          enableWhitelist: votingSettings.enableWhitelist,
          whitelistAddresses: whitelistAddressesToSend,
          whitelistWeights: votingSettings.whitelistWeights,
          whitelistWeightsEnabled: votingSettings.whitelistWeightsEnabled,
          polls: pollData
        });
      } catch (buildError) {
        setFailedStep(TransactionStatus.BUILDING);
        throw buildError;
      }

      setTxProgress(50);
      setTxStatus(TransactionStatus.SIGNING);
      
      toast.success('Transaction ready for signing', {
        description: 'Please approve the transaction in your wallet',
        duration: 3000
      });

      // STEP 8: Execute transaction
      let result;
      try {
        result = await transaction.execute();
      } catch (signingError) {
        setFailedStep(TransactionStatus.SIGNING);
        throw signingError;
      }
      
      setTxProgress(80);
      setTxStatus(TransactionStatus.EXECUTING);
      setTxDigest(result.digest);
      
      toast.success('Transaction submitted', {
        description: 'Waiting for blockchain confirmation...',
        duration: 3000
      });

      // STEP 9: Wait for confirmation
      setTxStatus(TransactionStatus.CONFIRMING);
      setTxProgress(90);
      
      try {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      } catch (confirmError) {
        setFailedStep(TransactionStatus.CONFIRMING);
        throw confirmError;
      }

      // STEP 10: Success handling
      setTxStatus(TransactionStatus.SUCCESS);
      setTxProgress(100);

      toast.success('Vote created successfully!', {
        description: 'Your vote has been published to the blockchain and is now live',
        icon: <Check className="h-4 w-4" />,
        duration: 6000
      });

      // Clear form data and prepare for redirect
      if (typeof window !== 'undefined') {
        localStorage.removeItem('voteFormData');
      }
      
      setTimeout(() => {
        // Navigate to success page with vote data
        router.push(`/success?digest=${result.digest}${result.voteId ? `&voteId=${result.voteId}` : ''}`);
      }, 1500);
    } catch (err) {
      console.error('Vote creation failed:', err);
      
      setTxStatus(TransactionStatus.ERROR);
      setSubmitting(false);
      
      // Determine error type and provide specific guidance
      let errorTitle = 'Failed to create vote';
      let errorDescription = 'Please try again or contact support if the issue persists';
      
      if (err instanceof Error) {
        const errorMsg = err.message.toLowerCase();
        
        if (errorMsg.includes('user rejected') || errorMsg.includes('rejected')) {
          errorTitle = 'Transaction cancelled';
          errorDescription = 'You cancelled the transaction in your wallet. You can try again when ready.';
        } else if (errorMsg.includes('insufficient')) {
          errorTitle = 'Insufficient funds';
          errorDescription = 'You need more SUI tokens to pay for transaction fees. Please add funds to your wallet.';
        } else if (errorMsg.includes('network') || errorMsg.includes('connection')) {
          errorTitle = 'Network error';
          errorDescription = 'Please check your internet connection and try again.';
        } else if (errorMsg.includes('timeout')) {
          errorTitle = 'Transaction timeout';
          errorDescription = 'The transaction took too long to process. Please try again.';
        } else if (errorMsg.includes('wallet')) {
          errorTitle = 'Wallet error';
          errorDescription = 'There was an issue with your wallet connection. Please reconnect and try again.';
        } else {
          errorDescription = err.message;
        }
      }
      
      setTransactionError(errorTitle);
      
      toast.error(errorTitle, {
        description: errorDescription,
        icon: <AlertCircle className="h-4 w-4" />,
        duration: 8000,
        action: errorTitle === 'Transaction cancelled' ? {
          label: 'Try Again',
          onClick: () => handleSubmit(mediaHandlers)
        } : undefined
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Get transaction explorer URL
  const getTransactionExplorerUrl = () => {
    if (!txDigest) return "#"

    const network = SUI_CONFIG.NETWORK.toLowerCase()
    if (network === "mainnet") {
      return `https://explorer.sui.io/txblock/${txDigest}`
    } else {
      return `https://explorer.sui.io/txblock/${txDigest}?network=${network}`
    }
  }

  // Animation variants
  const fadeIn = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { duration: 0.3 } },
  }

  const slideUp = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  }

  return (
    <VoteMediaHandler>
      {(mediaHandlers) => (
        <motion.div initial="hidden" animate="visible" variants={fadeIn} className="container max-w-7xl py-4 sm:py-6 lg:py-8 px-3 sm:px-4 lg:px-6">
          {/* Enhanced Responsive Header */}
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="bg-gradient-to-r from-background/95 via-background/98 to-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 border border-border/50 rounded-xl sm:rounded-2xl shadow-lg mb-6 sm:mb-8 p-4 sm:p-6"
          >
            <div className="flex flex-col gap-4 sm:gap-6">
              <div className="flex-1">
                <div className="flex items-start sm:items-center gap-3 mb-3">
                  <div className="p-2 sm:p-3 rounded-lg sm:rounded-xl bg-gradient-to-br from-primary/20 to-blue-500/10 flex-shrink-0">
                    <PlusCircle className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h1 className="text-xl sm:text-2xl lg:text-3xl xl:text-4xl font-bold bg-gradient-to-r from-foreground via-primary to-foreground bg-clip-text text-transparent leading-tight">
                      {voteTitle ? voteTitle : "Create New Vote"}
                    </h1>
                    <p className="text-muted-foreground mt-1 text-sm sm:text-base lg:text-lg">
                      Build transparent and secure voting experiences
                    </p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full">
                <Button
                  variant="outline"
                  size="default"
                  onClick={clearSavedData}
                  className="flex-1 sm:flex-none gap-2 hover:bg-destructive/5 hover:border-destructive/20 hover:text-destructive transition-all duration-300 min-w-0"
                  title="Clear all saved data and start fresh"
                >
                  <Trash2 className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">Reset</span>
                </Button>
                <Link href="/dashboard" className="flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    size="default"
                    className="w-full gap-2 hover:bg-muted/50 transition-all duration-300 min-w-0"
                  >
                    <ChevronLeft className="h-4 w-4 flex-shrink-0" />
                    <span className="truncate">Back to Dashboard</span>
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>

          {/* Environment Variable Error Alert */}
          <AnimatePresence mode="wait">
            {errors.environment && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4"
              >
                <Alert variant="destructive" role="alert">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>Configuration Error</AlertTitle>
                  <AlertDescription>{errors.environment}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Title Error Alert */}
          <AnimatePresence mode="wait">
            {errors.title && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="mb-4"
              >
                <Alert variant="destructive" role="alert">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{errors.title}</AlertDescription>
                </Alert>
              </motion.div>
            )}
          </AnimatePresence>

          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            {/* Enhanced Responsive Sticky Tab Navigation */}
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3, delay: 0.1 }}
              className="sticky top-14 md:top-16 z-30 bg-gradient-to-r from-background/95 via-background/98 to-background/95 backdrop-blur-xl supports-[backdrop-filter]:bg-background/80 border border-border/50 rounded-xl sm:rounded-2xl shadow-lg mb-6 sm:mb-8 p-3 sm:p-4"
            >
              <TabsList className="grid grid-cols-3 w-full bg-muted/30 p-1 rounded-lg sm:rounded-xl">
                <TabsTrigger
                  value="details"
                  className="flex items-center justify-center gap-1 sm:gap-2 transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:scale-105 rounded-md sm:rounded-lg py-2 sm:py-3 px-2 sm:px-3 min-w-0"
                >
                  <FileText className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="font-medium text-xs sm:text-sm truncate">Details</span>
                  {isSectionComplete("details") && (
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600 flex-shrink-0" />
                  )}
                </TabsTrigger>
                <TabsTrigger 
                  value="polls" 
                  className="flex items-center justify-center gap-1 sm:gap-2 transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:scale-105 rounded-md sm:rounded-lg py-2 sm:py-3 px-2 sm:px-3 min-w-0"
                >
                  <ListChecks className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="font-medium text-xs sm:text-sm truncate">Polls</span>
                  {isSectionComplete("polls") && (
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600 flex-shrink-0" />
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="settings"
                  className="flex items-center justify-center gap-1 sm:gap-2 transition-all duration-300 data-[state=active]:bg-background data-[state=active]:shadow-md data-[state=active]:scale-105 rounded-md sm:rounded-lg py-2 sm:py-3 px-2 sm:px-3 min-w-0"
                >
                  <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="font-medium text-xs sm:text-sm truncate">Settings</span>
                  {isSectionComplete("settings") && (
                    <Check className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-green-600 flex-shrink-0" />
                  )}
                </TabsTrigger>
              </TabsList>
            </motion.div>

            <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
              {/* Enhanced Responsive Sidebar */}
              <motion.div variants={slideUp} className="w-full lg:w-64 xl:w-72 flex-shrink-0 order-2 lg:order-1">
                <div className="lg:sticky lg:top-32">
                  <Card className="border-0 bg-gradient-to-br from-background/80 to-muted/10 backdrop-blur-sm shadow-lg hover:shadow-xl transition-all duration-500">
                    <CardContent className="p-4 sm:p-6">
                      {activeTab === "polls" && (
                        <div className="mt-4 space-y-1">
                          <div className="flex items-center justify-between mb-2">
                            <h3 className="text-sm font-medium">Poll List</h3>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 text-xs transition-all hover:scale-110"
                              onClick={addPoll}
                            >
                              <PlusCircle className="h-3.5 w-3.5 mr-1" />
                              Add
                            </Button>
                          </div>
                          <div className="space-y-1 max-h-[300px] overflow-y-auto pr-1">
                            <DndContext
                              sensors={sensors}
                              collisionDetection={closestCenter}
                              onDragStart={handleDragStart}
                              onDragEnd={handleDragEnd}
                            >
                              <SortableContext 
                                items={polls.map(poll => poll.id)}
                                strategy={verticalListSortingStrategy}
                              >
                                {polls.map((poll, index) => (
                                  <SortablePollItem
                                    key={poll.id}
                                    poll={poll}
                                    index={index}
                                    activePollIndex={activePollIndex}
                                    setActivePollIndex={setActivePollIndex}
                                    removePoll={removePoll}
                                    pollsLength={polls.length}
                                  />
                                ))}
                              </SortableContext>
                              <DragOverlay>
                                {activeId ? (
                                  <div className="bg-background border rounded-md shadow-md p-2 w-full">
                                    <div className="flex items-center">
                                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground mr-2" />
                                      <span className="text-xs">
                                        {polls.find(poll => poll.id === activeId)?.title || `Poll ${polls.findIndex(poll => poll.id === activeId) + 1}`}
                                      </span>
                                    </div>
                                  </div>
                                ) : null}
                              </DragOverlay>
                            </DndContext>
                          </div>
                        </div>
                      )}

                      {/* Enhanced Progress indicator */}
                      <div className="mt-8 space-y-4">
                        <div className="flex justify-between text-sm font-medium">
                          <span className="text-foreground">Progress</span>
                          <span className="text-primary">{activeTab === "details" ? "1" : activeTab === "polls" ? "2" : "3"}/3</span>
                        </div>
                        <div className="w-full bg-muted/50 h-2 rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: activeTab === "details" ? "33%" : activeTab === "polls" ? "66%" : "100%" }}
                            animate={{ width: activeTab === "details" ? "33%" : activeTab === "polls" ? "66%" : "100%" }}
                            transition={{ duration: 0.5, ease: "easeInOut" }}
                            className="bg-gradient-to-r from-primary to-blue-500 h-full rounded-full shadow-sm"
                          ></motion.div>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className={`text-center p-2 rounded-lg transition-all duration-300 ${
                            activeTab === "details" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                          }`}>
                            Details
                          </div>
                          <div className={`text-center p-2 rounded-lg transition-all duration-300 ${
                            activeTab === "polls" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                          }`}>
                            Polls
                          </div>
                          <div className={`text-center p-2 rounded-lg transition-all duration-300 ${
                            activeTab === "settings" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground"
                          }`}>
                            Settings
                          </div>
                        </div>
                      </div>

                      {/* Enhanced Quick tips */}
                      <div className="mt-8 p-4 bg-gradient-to-br from-primary/5 to-blue-500/5 rounded-xl border border-primary/10">
                        <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                          <div className="p-1.5 rounded-lg bg-primary/10">
                            <Info className="h-4 w-4 text-primary" />
                          </div>
                          Quick Tips
                        </h3>
                        <ul className="text-sm space-y-3 text-muted-foreground">
                          <li className="flex gap-3">
                            <div className="h-5 w-5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="h-3 w-3 text-white" />
                            </div>
                            <span className="leading-relaxed">Keep poll questions clear and concise</span>
                          </li>
                          <li className="flex gap-2">
                            <div className="h-3.5 w-3.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                            <span>Add images to make options more engaging</span>
                          </li>
                          <li className="flex gap-2">
                            <div className="h-3.5 w-3.5 rounded-full bg-green-500 flex items-center justify-center flex-shrink-0 mt-0.5">
                              <Check className="h-2.5 w-2.5 text-white" />
                            </div>
                            <span>Set a reasonable voting timeframe</span>
                          </li>
                        </ul>
                      </div>

                      {/* Vote Preview Card - Desktop Only */}
                      <div className="mt-6 hidden md:block">
                        <Card className="border-dashed transition-all hover:shadow-md">
                          <CardHeader className="p-3">
                            <CardTitle className="text-sm">Vote Preview</CardTitle>
                            <CardDescription className="text-xs">How your vote will appear</CardDescription>
                          </CardHeader>
                          <CardContent className="p-3">
                            <div className="rounded-lg border p-3 bg-muted/20">
                              <div className="flex flex-col gap-2">
                                <h3 className="font-semibold text-sm">{voteTitle || "Untitled Vote"}</h3>
                                <p className="text-xs text-muted-foreground line-clamp-2">{voteDescription || "No description provided"}</p>

                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200">
                                    {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
                                  </Badge>

                                  {votingSettings.requiredToken !== "none" && (
                                    <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                                      Requires {votingSettings.requiredToken.length > 10
                                        ? `${votingSettings.requiredToken.substring(0, 6)}...${votingSettings.requiredToken.substring(votingSettings.requiredToken.length - 4)}`
                                        : votingSettings.requiredToken.toUpperCase()}
                                    </Badge>
                                  )}

                                  {votingSettings.enableWhitelist && (
                                    <Badge variant="outline" className="text-xs bg-slate-50 text-slate-700 border-slate-200">
                                      Whitelist {votingSettings.whitelistWeightsEnabled ? "(Weighted)" : "Only"}
                                    </Badge>
                                  )}

                                  {votingSettings.isTokenWeighted && !(votingSettings.whitelistWeightsEnabled || votingSettings.enableWeightedPayment) && (
                                    <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200">
                                      Token Weighted ({votingSettings.tokenWeight} per vote)
                                    </Badge>
                                  )}

                                  {votingSettings.enableWeightedPayment && (
                                    <Badge variant="outline" className="text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                                      Weighted Payment ({votingSettings.tokenWeight} {votingSettings.requiredToken !== "none" ? "tokens" : "SUI"} per vote)
                                    </Badge>
                                  )}

                                  {Number(votingSettings.paymentAmount) > 0 && (
                                    <Badge variant="outline" className="text-xs bg-amber-50 text-amber-700 border-amber-200">
                                      Payment: {votingSettings.paymentAmount} SUI
                                    </Badge>
                                  )}

                                  {showLiveStats && (
                                    <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700 border-purple-200">
                                      <BarChart2 className="h-3 w-3 mr-1" />
                                      Live Results
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>

              {/* Enhanced Responsive Main Content Area */}
              <motion.div variants={slideUp} className="flex-1 order-1 lg:order-2 min-w-0">
                <TabsContent value="details" className="mt-0">
                  <Card className="transition-all hover:shadow-md">
                    <CardHeader className="p-4 sm:p-6">
                      <CardTitle className="text-xl sm:text-2xl">Vote Details</CardTitle>
                      <CardDescription>Create a new vote with multiple polls</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-6">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="title" className="text-base font-medium">
                            Vote Title <span className="text-red-500">*</span>
                          </Label>
                          <span className={cn(
                            "text-xs transition-colors",
                            voteTitle.length > 100 ? "text-red-500" : 
                            voteTitle.length > 80 ? "text-yellow-600" : "text-muted-foreground"
                          )}>
                            {voteTitle.length}/100
                          </span>
                        </div>
                        <Input
                          id="title"
                          placeholder="Enter a title for this vote"
                          value={voteTitle}
                          onChange={(e) => {
                            setVoteTitle(e.target.value);
                            // Real-time validation
                            setTimeout(() => validateForm(false), 0);
                          }}
                          onBlur={() => {
                            setTouchedFields(prev => ({ ...prev, title: true }))
                            setTimeout(() => validateForm(false), 100)
                          }}
                          className={cn(
                            "h-12 transition-all focus:scale-[1.01]",
                            errors.title && "border-red-500 focus-visible:ring-red-500",
                            voteTitle.length > 100 && "border-red-500"
                          )}
                          maxLength={100}
                          required
                        />
                        {errors.title && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3 w-3" />
                            {errors.title}
                          </motion.p>
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Label htmlFor="description" className="text-base font-medium">
                            Vote Description
                          </Label>
                          <span className={cn(
                            "text-xs transition-colors",
                            voteDescription.length > 500 ? "text-red-500" : 
                            voteDescription.length > 400 ? "text-yellow-600" : "text-muted-foreground"
                          )}>
                            {voteDescription.length}/500
                          </span>
                        </div>
                        <Textarea
                          id="description"
                          placeholder="Provide context or additional information about this vote"
                          value={voteDescription}
                          onChange={(e) => {
                            setVoteDescription(e.target.value);
                            // Real-time validation
                            setTimeout(() => validateForm(false), 0);
                          }}
                          onBlur={() => {
                            setTouchedFields(prev => ({ ...prev, description: true }))
                            setTimeout(() => validateForm(false), 100)
                          }}
                          className={cn(
                            "min-h-[150px] resize-none transition-all focus:scale-[1.01]",
                            voteDescription.length > 500 && "border-red-500"
                          )}
                          maxLength={500}
                        />
                        {errors.description && (
                          <motion.p
                            initial={{ opacity: 0, y: -5 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-sm text-red-500 flex items-center gap-1"
                          >
                            <AlertCircle className="h-3 w-3" />
                            {errors.description}
                          </motion.p>
                        )}
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end p-4">
                      <Button
                        onClick={() => {
                          // Validate form and proceed if valid
                          if (validateForm()) {
                            setActiveTab("polls");
                          }
                        }}
                        className="transition-all hover:scale-105"
                      >
                        Continue to Polls
                        <ArrowRight className="ml-2 h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                <TabsContent value="polls" className="mt-0">
                  {/* Update the error alert in the polls tab to include role="alert" for accessibility */}

                  <AnimatePresence mode="wait">
                    {errors.polls && Object.keys(errors.polls).length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="mb-4"
                      >
                        <Alert variant="destructive" role="alert">
                          <AlertCircle className="h-4 w-4" />
                          <AlertDescription>Please fix the errors in your polls</AlertDescription>
                        </Alert>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {polls.length > 0 && (
                    <Card className="transition-all hover:shadow-md">
                      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <div>
                          <CardTitle className="text-xl">
                            Poll {activePollIndex + 1} of {polls.length}
                          </CardTitle>
                          <CardDescription>{polls[activePollIndex].title || "Untitled Poll"}</CardDescription>
                        </div>
                        {polls.length > 1 && (
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removePoll(activePollIndex)}
                            className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 transition-all hover:scale-110"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </CardHeader>
                      <CardContent className="pt-4 space-y-6">
                        {/* Poll Required Toggle */}
                        <div className="flex items-center justify-between p-3 rounded-lg border bg-muted/30">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              id={`poll-required-top-${activePollIndex}`}
                              checked={polls[activePollIndex].isRequired}
                              onChange={(e) => updatePollRequired(activePollIndex, e.target.checked)}
                              className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded cursor-pointer"
                            />
                            <div className="space-y-0.5">
                              <Label htmlFor={`poll-required-top-${activePollIndex}`} className="text-sm font-medium cursor-pointer select-none">
                                Required Poll
                              </Label>
                              <p className="text-xs text-muted-foreground">
                                {polls[activePollIndex].isRequired 
                                  ? "Voters must answer this poll" 
                                  : "This poll is optional"}
                              </p>
                            </div>
                          </div>
                          <Badge variant={polls[activePollIndex].isRequired ? "destructive" : "secondary"}>
                            {polls[activePollIndex].isRequired ? "Required" : "Optional"}
                          </Badge>
                        </div>
                        
                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`poll-title-${activePollIndex}`} className="text-base font-medium">
                              Poll Title <span className="text-red-500">*</span>
                            </Label>
                            <span className={cn(
                              "text-xs transition-colors",
                              polls[activePollIndex].title.length > 150 ? "text-red-500" : 
                              polls[activePollIndex].title.length > 120 ? "text-yellow-600" : "text-muted-foreground"
                            )}>
                              {polls[activePollIndex].title.length}/150
                            </span>
                          </div>
                          <Input
                            id={`poll-title-${activePollIndex}`}
                            placeholder="Enter poll question"
                            value={polls[activePollIndex].title}
                            onChange={(e) => updatePollTitle(activePollIndex, e.target.value)}
                            onBlur={() => {
                              setTimeout(() => validateForm(false), 100)
                            }}
                            className={cn(
                              "h-12 transition-all focus:scale-[1.01]",
                              errors.polls?.[polls[activePollIndex].id]?.title &&
                              "border-red-500 focus-visible:ring-red-500",
                              polls[activePollIndex].title.length > 150 && "border-red-500"
                            )}
                            maxLength={150}
                            required
                          />
                          {errors.polls?.[polls[activePollIndex].id]?.title && (
                            <motion.p
                              initial={{ opacity: 0, y: -5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-sm text-red-500 flex items-center gap-1"
                            >
                              <AlertCircle className="h-3 w-3" />
                              {errors.polls[polls[activePollIndex].id].title}
                            </motion.p>
                          )}
                        </div>

                        <div className="space-y-2">
                          <div className="flex items-center justify-between">
                            <Label htmlFor={`poll-description-${activePollIndex}`} className="text-base font-medium">
                              Poll Description (Optional)
                            </Label>
                            <span className={cn(
                              "text-xs transition-colors",
                              polls[activePollIndex].description.length > 300 ? "text-red-500" : 
                              polls[activePollIndex].description.length > 250 ? "text-yellow-600" : "text-muted-foreground"
                            )}>
                              {polls[activePollIndex].description.length}/300
                            </span>
                          </div>
                          <Textarea
                            id={`poll-description-${activePollIndex}`}
                            placeholder="Provide additional context for this poll"
                            value={polls[activePollIndex].description}
                            onChange={(e) => updatePollDescription(activePollIndex, e.target.value)}
                            className={cn(
                              "min-h-[80px] resize-none transition-all focus:scale-[1.01]",
                              polls[activePollIndex].description.length > 300 && "border-red-500"
                            )}
                            maxLength={300}
                          />
                        </div>

                        <div className="space-y-4">
                          <Label className="text-base font-medium">Selection Type</Label>
                          <RadioGroup
                            value={polls[activePollIndex].isMultiSelect ? "multi" : "single"}
                            onValueChange={(value) => updatePollType(activePollIndex, value === "multi")}
                            className="flex flex-col sm:flex-row gap-4"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="single" id={`single-select-${activePollIndex}`} />
                              <Label htmlFor={`single-select-${activePollIndex}`}>Single Select (Radio Buttons)</Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="multi" id={`multi-select-${activePollIndex}`} />
                              <Label htmlFor={`multi-select-${activePollIndex}`}>Multi Select (Checkboxes)</Label>
                            </div>
                          </RadioGroup>
                        </div>

                        {polls[activePollIndex].isMultiSelect && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            className="space-y-4 p-4 bg-muted/30 rounded-lg"
                          >
                            <div className="flex items-center justify-between">
                              <Label htmlFor={`max-selections-${activePollIndex}`} className="text-base font-medium">
                                Maximum Selections Allowed
                              </Label>
                              <span className="text-sm font-medium">
                                {polls[activePollIndex].maxSelections} of {polls[activePollIndex].options.length}
                              </span>
                            </div>
                            <Slider
                              id={`max-selections-${activePollIndex}`}
                              min={1}
                              max={Math.max(1, polls[activePollIndex].options.length - 1)}
                              step={1}
                              value={[polls[activePollIndex].maxSelections]}
                              onValueChange={(value) => updateMaxSelections(activePollIndex, value[0])}
                            />
                            <p className="text-sm text-muted-foreground">
                              Voters can select up to {polls[activePollIndex].maxSelections} option
                              {polls[activePollIndex].maxSelections !== 1 ? "s" : ""}
                            </p>

                            {errors.polls?.[polls[activePollIndex].id]?.maxSelections && (
                              <p className="text-sm text-red-500">
                                {errors.polls[polls[activePollIndex].id].maxSelections}
                              </p>
                            )}
                          </motion.div>
                        )}



                        <Separator />

                        <div className="space-y-4">
                          <div className="flex items-center justify-between">
                            <Label className="text-base font-medium">Poll Options</Label>
                            <span className="text-sm text-muted-foreground">Minimum 2 options required</span>
                          </div>

                          {errors.polls?.[polls[activePollIndex].id]?.options && (
                            <p className="text-sm text-red-500">{errors.polls[polls[activePollIndex].id].options}</p>
                          )}

                          <div className="space-y-3">
                            {polls[activePollIndex].options.map((option, optionIndex) => (
                              <motion.div
                                key={option.id}
                                className="border rounded-lg p-3"
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ duration: 0.3 }}
                              >
                                <div className="space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div className="w-6 h-6 flex items-center justify-center text-muted-foreground font-medium text-sm border rounded">
                                        {optionIndex + 1}
                                      </div>
                                      <span className="text-sm font-medium text-muted-foreground">Option {optionIndex + 1}</span>
                                    </div>
                                    <span className={cn(
                                      "text-xs transition-colors",
                                      option.text.length > 100 ? "text-red-500" : 
                                      option.text.length > 80 ? "text-yellow-600" : "text-muted-foreground"
                                    )}>
                                      {option.text.length}/100
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      placeholder={`Enter option ${optionIndex + 1} text`}
                                      value={option.text}
                                      onChange={(e) => updateOption(activePollIndex, optionIndex, e.target.value)}
                                      onBlur={() => {
                                        setTimeout(() => validateForm(false), 100)
                                      }}
                                      className={cn(
                                        "h-12 transition-all focus:scale-[1.01]",
                                        errors.polls?.[polls[activePollIndex].id]?.optionTexts?.[optionIndex] &&
                                        "border-red-500 focus-visible:ring-red-500",
                                        option.text.length > 100 && "border-red-500"
                                      )}
                                      maxLength={100}
                                      required
                                    />
                                    {polls[activePollIndex].options.length > 2 && (
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => removeOption(activePollIndex, optionIndex)}
                                        className="text-destructive hover:text-destructive/90 hover:bg-destructive/10 flex-shrink-0 transition-all hover:scale-110"
                                      >
                                        <Trash2 className="h-5 w-5" />
                                      </Button>
                                    )}
                                  </div>
                                  {errors.polls?.[polls[activePollIndex].id]?.optionTexts?.[optionIndex] && (
                                    <motion.p
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="text-sm text-red-500 flex items-center gap-1"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      {errors.polls[polls[activePollIndex].id].optionTexts?.[optionIndex]}
                                    </motion.p>
                                  )}
                                </div>

                                <div className="mt-2">
                  
                                  {option.mediaUrl ? (
                                    <div className="flex items-center gap-3">
                                      <div className="relative group h-20 w-20 rounded-md border overflow-hidden bg-muted">
                                        {/* Add loading state */}
                                        {option.mediaUrl === 'loading' && (
                                          <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
                                            <div className="relative h-5 w-5">
                                              <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
                                            </div>
                                          </div>
                                        )}
                                        {option.mediaUrl && option.mediaUrl !== 'loading' && (
                                          <img
                                            src={option.mediaUrl}
                                            alt={`Option ${optionIndex + 1} media`}
                                            className="h-full w-full object-cover"
                                            onError={(e) => {
                                              // Handle image loading errors
                                              console.error("Image failed to load:", option.mediaUrl);
                                              e.currentTarget.src = "/placeholder.svg";
                                            }}
                                          />
                                        )}

                                        <Button
                                          type="button"
                                          variant="destructive"
                                          size="icon"
                                          className="absolute top-1 right-1 h-5 w-5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity z-20"
                                          onClick={() => mediaHandlers && removeMediaFromOption(mediaHandlers, activePollIndex, optionIndex)}
                                        >
                                          <X className="h-3 w-3" />
                                        </Button>

                                        {option.fileId && mediaHandlers.uploadProgress[option.fileId] > 0 && mediaHandlers.uploadProgress[option.fileId] < 100 && (
                                          <div className="absolute inset-0 bg-background/80 flex flex-col items-center justify-center">
                                            <Progress value={mediaHandlers.uploadProgress[option.fileId]} className="w-3/4 h-2" />
                                            <p className="text-xs mt-2">{mediaHandlers.uploadProgress[option.fileId]}% ready</p>
                                          </div>
                                        )}
                                      </div>
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-8 text-xs"
                                        onClick={() => {
                                          // Create a file input and trigger it
                                          const input = document.createElement('input');
                                          input.type = 'file';
                                          input.accept = 'image/*';
                                          input.onchange = (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file && mediaHandlers) {
                                              addMediaToOption(mediaHandlers, activePollIndex, optionIndex, file);
                                            }
                                          };
                                          input.click();
                                        }}
                                      >
                                        Change Image
                                      </Button>
                                    </div>
                                  ) : (
                                    <div className="flex items-center">
                                      <Button
                                        type="button"
                                        variant="outline"
                                        size="sm"
                                        className="h-9 text-xs flex items-center gap-1.5"
                                        onClick={() => {
                                          // Create a file input and trigger it
                                          const input = document.createElement('input');
                                          input.type = 'file';
                                          input.accept = 'image/*';
                                          input.onchange = (e) => {
                                            const file = (e.target as HTMLInputElement).files?.[0];
                                            if (file && mediaHandlers) {
                                              addMediaToOption(mediaHandlers, activePollIndex, optionIndex, file);
                                            }
                                          };
                                          input.click();
                                        }}
                                      >
                                        <ImageIcon className="h-3.5 w-3.5" />
                                        Add Image
                                      </Button>
                                      <p className="text-xs text-muted-foreground ml-3">JPG, PNG, GIF (max 5MB)</p>
                                    </div>
                                  )}
                                </div>

                              </motion.div>
                            ))}
                          </div>

                          <Button
                            variant="outline"
                            onClick={() => addOption(activePollIndex)}
                            className="w-full h-12 border-dashed transition-all hover:bg-muted/50"
                          >
                            <PlusCircle className="mr-2 h-4 w-4" />
                            Add Option
                          </Button>
                        </div>
                      </CardContent>
                      <CardFooter className="flex justify-between p-4">
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full h-8 w-8 transition-all hover:scale-110"
                            onClick={() => {
                              if (activePollIndex > 0) {
                                setActivePollIndex(activePollIndex - 1)
                              }
                            }}
                            disabled={activePollIndex === 0}
                            title="Previous poll"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            <span className="sr-only">Previous poll</span>
                          </Button>
                          <Button
                            variant="outline"
                            size="icon"
                            className="rounded-full h-8 w-8 transition-all hover:scale-110"
                            onClick={() => {
                              if (activePollIndex < polls.length - 1) {
                                setActivePollIndex(activePollIndex + 1)
                              }
                            }}
                            disabled={activePollIndex === polls.length - 1}
                            title="Next poll"
                          >
                            <ChevronRight className="h-4 w-4" />
                            <span className="sr-only">Next poll</span>
                          </Button>
                          <span className="text-xs text-muted-foreground ml-1">Navigate between polls</span>
                        </div>
                        <Button onClick={() => {
                          if (isSectionComplete("polls")) {
                            setActiveTab("settings");
                          } else {
                            validateForm();
                            toast.error("Please complete all poll options", {
                              description: "All polls must have a title and at least 2 options with text",
                              icon: <AlertCircle className="h-4 w-4" />
                            });
                          }
                        }} className="gap-2 transition-all hover:scale-105">
                          Continue
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </CardFooter>
                    </Card>
                  )}
                </TabsContent>

                <TabsContent value="settings" className="mt-0">
                  <Card className="transition-all hover:shadow-md">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <div>
                        <CardTitle className="text-2xl">Voting Settings</CardTitle>
                        <CardDescription>Configure how voting works for this poll</CardDescription>
                      </div>
                      <div className="bg-primary/10 p-2 rounded-full">
                        <Settings className="h-5 w-5 text-primary" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-6 pt-6">
                      <div className="grid gap-6 md:grid-cols-2">
                        {/* Voting Timeframe */}
                        <div className="md:col-span-2 space-y-4">
                          <Label className="text-base font-medium flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            Voting Timeframe <span className="text-red-500">*</span>
                          </Label>

                          <AnimatePresence mode="wait">
                            {errors.votingSettings?.dates && (
                              <motion.div
                                initial={{ opacity: 0, y: -10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -10 }}
                              >
                                <p className="text-sm text-red-500">{errors.votingSettings.dates}</p>
                              </motion.div>
                            )}
                          </AnimatePresence>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <DateTimePicker
                              id="start-date"
                              value={startDate}
                              onChange={(date) => {
                                // Ensure date is in the future
                                const now = new Date();
                                const validDate = date && date > now ? date : new Date(now.getTime() + 10 * 60 * 1000);

                                setStartDate(validDate);
                                setVotingSettings(prev => ({
                                  ...prev,
                                  startDate: validDate
                                }));

                                // Mark dates as touched
                                setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, dates: true } }))

                                // If end date is now before or equal to start date, update it too
                                if (!isAfter(endDate, validDate)) {
                                  const newEndDate = new Date(validDate.getTime() + 24 * 60 * 60 * 1000); // 1 day after
                                  setEndDate(newEndDate);
                                  setVotingSettings(prev => ({
                                    ...prev,
                                    endDate: newEndDate
                                  }));
                                }
                                
                                // Validate with smart validation
                                setTimeout(() => validateForm(false), 100);
                              }}
                              label="Start date and time"
                              data-error={!!errors.votingSettings?.dates}
                            />

                            <DateTimePicker
                              id="end-date"
                              value={endDate}
                              onChange={(date) => {
                                // Ensure date is after start date
                                const validDate = date && isAfter(date, startDate) ? date : new Date(startDate.getTime() + 24 * 60 * 60 * 1000);

                                setEndDate(validDate);
                                setVotingSettings(prev => ({
                                  ...prev,
                                  endDate: validDate
                                }));
                                
                                // Mark dates as touched
                                setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, dates: true } }))
                                
                                // Validate with smart validation
                                setTimeout(() => validateForm(false), 100);
                              }}
                              label="End date and time"
                              data-error={!!errors.votingSettings?.dates}
                            />
                          </div>
                        </div>

                        {/* Token Requirements */}
                        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                          <Label className="text-base font-medium flex items-center gap-2">
                            <Wallet className="h-4 w-4" />
                            Token Requirements
                          </Label>
                          <div className="space-y-4">
                            <TokenSelector
                              value={votingSettings.requiredToken}
                              onValueChange={(value) => {
                                setVotingSettings({
                                  ...votingSettings,
                                  requiredToken: value,
                                  // Reset token weighted settings if no token is required
                                 isTokenWeighted: value === "none" ? false : votingSettings.isTokenWeighted,
                                 // Update token weight default for SUI when switching to no token
                                 tokenWeight: value === "none" && votingSettings.tokenWeight === "1" ? "0.1" : votingSettings.tokenWeight,
                                })
                                // Mark dates as touched
                                setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, dates: true } }))
                                setTimeout(() => validateForm(false), 100)
                              }}
                              onAmountChange={(amount) => {
                                setVotingSettings({ ...votingSettings, requiredAmount: amount })
                                // Mark token as touched when amount changes
                                setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, token: true } }))
                                // Validate immediately with the new amount value
                                setTimeout(() => {
                                  // Create updated voting settings for validation
                                  const updatedSettings = { ...votingSettings, requiredAmount: amount }
                                  validateFormWithSettings(false, updatedSettings)
                                }, 0)
                              }}
                              amount={votingSettings.requiredAmount}
                              error={errors.votingSettings?.token}
                              required={false}

                            />

                            {/* Token Weighting Section - Disabled when Weighted Vote Payment or Whitelist Weights are enabled */}
                            {votingSettings.requiredToken !== "none" && (
                              <div className="space-y-4 mt-4 p-4 bg-background/50 rounded-lg border">
                                <div className="flex items-center justify-between">
                                  <div className="space-y-1">
                                    <Label className={cn("text-sm font-medium", (votingSettings.whitelistWeightsEnabled || votingSettings.enableWeightedPayment) && "text-muted-foreground")}>Enable Token Weighting</Label>
                                    <p className="text-xs text-muted-foreground">
                                      {votingSettings.whitelistWeightsEnabled 
                                        ? "Disabled when custom whitelist weights are enabled"
                                        : votingSettings.enableWeightedPayment
                                        ? "Disabled when weighted vote payment is enabled"
                                        : "Allow votes to be weighted based on token holdings"
                                      }
                                    </p>
                                  </div>
                                  <Switch
                                    checked={votingSettings.isTokenWeighted && !(votingSettings.whitelistWeightsEnabled || votingSettings.enableWeightedPayment)}
                                    disabled={votingSettings.whitelistWeightsEnabled || votingSettings.enableWeightedPayment}
                                    onCheckedChange={(checked) => {
                                      // Preserve current values before disabling
                                      if (checked) {
                                        setPreservedValues({
                                          ...preservedValues,
                                          paymentTokenWeight: votingSettings.paymentTokenWeight || "0.1",
                                          paymentAmount: votingSettings.paymentAmount || ""
                                        })
                                      }
                                      
                                      setVotingSettings({
                                        ...votingSettings,
                                        isTokenWeighted: checked,
                                        // Set default token weight when enabling
                                        tokenWeight: checked && votingSettings.tokenWeight === "0" ? "1" : votingSettings.tokenWeight,
                                        // Restore preserved payment values when disabling token weighting
                                        paymentTokenWeight: checked ? votingSettings.paymentTokenWeight : preservedValues.paymentTokenWeight,
                                        paymentAmount: checked ? votingSettings.paymentAmount : preservedValues.paymentAmount
                                      })
                                    }}
                                  />
                                </div>

                                {/* Token Weight Input */}
                                {votingSettings.isTokenWeighted && !(votingSettings.whitelistWeightsEnabled || votingSettings.enableWeightedPayment) && (
                                  <div className="space-y-2">
                                    <Label htmlFor="token-weight" className="text-sm">
                                      Tokens per Vote (Token Requirements)
                                    </Label>
                                    <Input
                                      id="token-weight"
                                      type="number"
                                      step="0.001"
                                      min="0.001"
                                      max="1000000"
                                      value={votingSettings.tokenWeight}
                                      onChange={(e) => {
                                        setVotingSettings({
                                          ...votingSettings,
                                          tokenWeight: e.target.value
                                        })
                                        // Mark as touched
                                        setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, tokenWeight: true } }))
                                        setTimeout(() => validateForm(false), 100)
                                      }}
                                      onBlur={() => {
                                        setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, tokenWeight: true } }))
                                        setTimeout(() => validateForm(false), 100)
                                      }}
                                      placeholder="1"
                                      className={cn(
                                        "w-full transition-all focus:scale-[1.01]",
                                        errors.votingSettings?.tokenWeight && "border-red-500 focus-visible:ring-red-500"
                                      )}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                      Number of tokens required per vote weight for token requirements. Higher values mean more tokens needed for stronger votes.
                                    </p>
                                    {errors.votingSettings?.tokenWeight && (
                                      <motion.p
                                        initial={{ opacity: 0, y: -5 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="text-sm text-red-500 flex items-center gap-1"
                                      >
                                        <AlertCircle className="h-3 w-3" />
                                        {errors.votingSettings.tokenWeight}
                                      </motion.p>
                                    )}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Separate whitelist section */}
                            <div className="mt-8 pt-6 border-t">
                              <h3 className="text-base font-medium mb-4">Voter Whitelist</h3>
                              <WhitelistSelector
                                enableWhitelist={votingSettings.enableWhitelist}
                                onWhitelistChange={(enabled) => {
                                  setVotingSettings({
                                    ...votingSettings,
                                    enableWhitelist: enabled,
                                  })
                                }}
                                whitelistAddresses={votingSettings.whitelistAddresses}
                                onWhitelistAddressesChange={(addresses) => {
                                  setVotingSettings({
                                    ...votingSettings,
                                    whitelistAddresses: addresses,
                                  })
                                }}
                                whitelistWeights={votingSettings.whitelistWeights}
                                onWhitelistWeightsChange={(weights) => {
                                  setVotingSettings({
                                    ...votingSettings,
                                    whitelistWeights: weights,
                                  })
                                }}
                                onVoteWeightsChange={(enabled) => {
                                  // Preserve current values before disabling
                                  if (enabled) {
                                    setPreservedValues({
                                      ...preservedValues,
                                      paymentTokenWeight: votingSettings.paymentTokenWeight || "0.1",
                                      tokenWeight: votingSettings.tokenWeight || "1",
                                      paymentAmount: votingSettings.paymentAmount || ""
                                    })
                                  }
                                  
                                  setVotingSettings({
                                    ...votingSettings,
                                    whitelistWeightsEnabled: enabled,
                                    // Disable other weight mechanisms when whitelist weights are enabled
                                    isTokenWeighted: enabled ? false : votingSettings.isTokenWeighted,
                                    enableWeightedPayment: enabled ? false : votingSettings.enableWeightedPayment,
                                    // Restore preserved values when re-enabling
                                    paymentTokenWeight: enabled ? votingSettings.paymentTokenWeight : preservedValues.paymentTokenWeight,
                                    tokenWeight: enabled ? votingSettings.tokenWeight : preservedValues.tokenWeight,
                                    paymentAmount: enabled ? votingSettings.paymentAmount : preservedValues.paymentAmount
                                  })
                                }}
                              />
                            </div>
                          </div>
                        </div>

                        {/* Payment Settings */}
                        <div className="space-y-6 p-4 bg-muted/30 rounded-lg">
                          {/* Payment Amount Section */}
                          <div className="space-y-4">
                            <Label className={cn("text-base font-medium flex items-center gap-2", votingSettings.enableWeightedPayment && "text-muted-foreground")}>
                              <Coins className="h-4 w-4" />
                              Payment Amount
                            </Label>
                            <div>
                              <Label htmlFor="payment-amount" className={cn("text-sm", votingSettings.enableWeightedPayment && "text-muted-foreground")}>
                                Amount to Pay by Voter
                              </Label>
                              <div className="flex items-center">
                                <Input
                                  id="payment-amount"
                                  type="number"
                                  min="0"
                                  max="1000000"
                                  step="0.01"
                                  placeholder="0.00"
                                  value={votingSettings.paymentAmount}
                                  onChange={(e) => {
                                    setVotingSettings({ ...votingSettings, paymentAmount: e.target.value })
                                    // Real-time validation
                                    setTimeout(() => validateForm(false), 0)
                                  }}
                                  onBlur={() => {
                                    setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, amount: true } }))
                                    setTimeout(() => validateForm(false), 100)
                                  }}
                                  disabled={votingSettings.enableWeightedPayment}
                                  className={cn(
                                    "h-10 transition-all focus:scale-[1.01]",
                                    errors.votingSettings?.amount && "border-red-500 focus-visible:ring-red-500",
                                  )}
                                />
                                <div className="ml-2 text-sm font-medium">
                                  <Coins className="h-4 w-4" />
                                </div>
                              </div>
                              <p className={cn("text-xs mt-1", votingSettings.enableWeightedPayment ? "text-muted-foreground" : "text-muted-foreground")}>
                                {votingSettings.enableWeightedPayment 
                                  ? "Disabled when weighted vote payment is enabled - payment amount determines vote weight"
                                  : "Amount in SUI that voters need to pay to participate (0 for free voting)"}
                              </p>
                              {errors.votingSettings?.amount && (
                                <motion.p
                                  initial={{ opacity: 0, y: -5 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  className="text-sm text-red-500 flex items-center gap-1"
                                >
                                  <AlertCircle className="h-3 w-3" />
                                  {errors.votingSettings.amount}
                                </motion.p>
                              )}
                            </div>
                          </div>

                          {/* Separator */}
                          <Separator />

                          {/* Weighted Vote Payment Section */}
                          <div className="space-y-4">
                            <Label className="text-base font-medium flex items-center gap-2">
                              <BarChart2 className="h-4 w-4" />
                              Weighted Vote Payment
                            </Label>
                            
                            <div className="flex items-center justify-between">
                              <div className="space-y-0.5">
                                <Label htmlFor="enable-weighted-payment" className={cn("text-base", votingSettings.whitelistWeightsEnabled && "text-muted-foreground")}>
                                  Enable weighted vote payment
                                </Label>
                                <p className="text-sm text-muted-foreground">
                                  {votingSettings.whitelistWeightsEnabled 
                                    ? "Disabled when custom whitelist weights are enabled"
                                    : votingSettings.enableWhitelist && !votingSettings.whitelistWeightsEnabled
                                    ? "Payment weighting for whitelisted voters only"
                                    : "Allow voters to pay SUI for additional vote weight"
                                  }
                                </p>
                              </div>
                              <Switch
                                id="enable-weighted-payment"
                                checked={votingSettings.enableWeightedPayment}
                                disabled={votingSettings.whitelistWeightsEnabled}
                                onCheckedChange={(checked) => {
                                  // Preserve current values before disabling
                                  if (checked) {
                                    setPreservedValues({
                                      ...preservedValues,
                                      tokenWeight: votingSettings.tokenWeight || "1",
                                      paymentAmount: votingSettings.paymentAmount || "0"
                                    })
                                  }
                                  
                                  setVotingSettings({ 
                                    ...votingSettings, 
                                    enableWeightedPayment: checked,
                                    // Disable token weighting when payment weighting is enabled (mutual exclusivity)
                                    isTokenWeighted: checked ? false : votingSettings.isTokenWeighted,
                                    // Set default payment token weight if not already set (for payment weighting)
                                    paymentTokenWeight: checked && !votingSettings.paymentTokenWeight ? (votingSettings.requiredToken === "none" ? "0.1" : "1") : votingSettings.paymentTokenWeight,
                                    // Restore preserved payment amount when disabling weighted payment
                                    paymentAmount: checked ? votingSettings.paymentAmount : (preservedValues.paymentAmount || votingSettings.paymentAmount),
                                    // Restore preserved token weight when disabling payment weighting
                                    tokenWeight: checked ? votingSettings.tokenWeight : preservedValues.tokenWeight
                                  })
                                }}
                              />
                            </div>

                            {votingSettings.enableWeightedPayment && (
                              <div className="space-y-4 pt-4 border-t">
                                <div className="space-y-3">
                                  <Label htmlFor="payment-token-weight" className="text-sm font-medium">
                                    {votingSettings.requiredToken !== "none" ? "Tokens per vote" : "SUI per vote"} (Payment Weighting) <span className="text-red-500">*</span>
                                  </Label>
                                  <div className="flex items-center gap-2">
                                    <Input
                                      id="payment-token-weight"
                                      type="number"
                                      min="0.001"
                                      max="1000000"
                                      step="any"
                                      placeholder={votingSettings.requiredToken !== "none" ? "1" : "0.1"}
                                      value={votingSettings.paymentTokenWeight}
                                      onChange={(e) => {
                                        setVotingSettings({
                                          ...votingSettings,
                                          paymentTokenWeight: e.target.value,
                                        })
                                        // Real-time validation
                                        setTimeout(() => validateForm(false), 0)
                                      }}
                                      onBlur={() => {
                                        setTouchedFields(prev => ({ ...prev, votingSettings: { ...prev.votingSettings, paymentTokenWeight: true } }))
                                        setTimeout(() => validateForm(false), 100)
                                      }}
                                      className={cn(
                                        "flex-1 transition-all focus:scale-[1.01]",
                                        errors.votingSettings?.paymentTokenWeight && "border-red-500 focus-visible:ring-red-500"
                                      )}
                                      data-error={!!errors.votingSettings?.paymentTokenWeight}
                                    />
                                    <div className="flex-shrink-0 text-sm font-medium text-muted-foreground w-20 text-center">
                                      {votingSettings.requiredToken !== "none" ? "tokens" : "SUI"}
                                    </div>
                                  </div>
                                  <p className="text-xs text-muted-foreground">
                                    Each {votingSettings.paymentTokenWeight} {votingSettings.requiredToken !== "none" ? "token(s)" : "SUI"} paid equals 1 vote weight. This is separate from token requirements weighting.
                                  </p>
                                  {errors.votingSettings?.paymentTokenWeight && (
                                    <motion.p
                                      initial={{ opacity: 0, y: -5 }}
                                      animate={{ opacity: 1, y: 0 }}
                                      className="text-sm text-red-500 flex items-center gap-1"
                                    >
                                      <AlertCircle className="h-3 w-3" />
                                      {errors.votingSettings.paymentTokenWeight}
                                    </motion.p>
                                  )}
                                </div>
                                
                                
                              </div>
                            )}
                          </div>
                        </div>

                        {/* General Settings */}
                        <div className="md:col-span-2 space-y-6 p-4 bg-muted/30 rounded-lg">
                          <Label className="text-base font-medium flex items-center gap-2">
                            <Settings className="h-4 w-4" />
                            General Settings
                          </Label>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="require-all-polls" className={cn("text-base", !hasRequiredPolls() && "text-muted-foreground")}>
                                Require voters to answer all polls
                              </Label>
                              <p className={cn("text-sm text-muted-foreground", !hasRequiredPolls() && "text-muted-foreground/70")}>
                                {hasRequiredPolls() 
                                  ? "Voters must complete every poll to submit" 
                                  : "No polls are marked as required - enable individual poll requirements first"
                                }
                              </p>
                            </div>
                            <Switch
                              id="require-all-polls"
                              checked={votingSettings.requireAllPolls}
                              disabled={!hasRequiredPolls()}
                              onCheckedChange={(checked) => {
                                setVotingSettings({ ...votingSettings, requireAllPolls: checked })
                                // If requiring all polls, set all polls to required
                                if (checked) {
                                  const newPolls = [...polls]
                                  newPolls.forEach((poll) => (poll.isRequired = true))
                                  setPolls(newPolls)
                                }
                              }}
                            />
                          </div>

                          <div className="flex items-center justify-between">
                            <div className="space-y-0.5">
                              <Label htmlFor="live-stats" className="text-base">
                                Show live voting statistics
                              </Label>
                              <p className="text-sm text-muted-foreground">Voters can see results before the vote closes</p>
                            </div>
                            <Switch
                              id="live-stats"
                              checked={showLiveStats}
                              onCheckedChange={(checked) => {
                                setShowLiveStats(checked)
                                setVotingSettings({ ...votingSettings, showLiveStats: checked })
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-between p-4">
                      <Button
                        variant="outline"
                        size="icon"
                        className="rounded-full h-8 w-8 transition-all hover:scale-110"
                        onClick={() => {
                          if (isSectionComplete("settings")) {
                            setActiveTab("polls");
                          } else {
                            validateForm();
                            toast.error("Please complete all settings", {
                              description: "Ensure all voting settings are properly configured",
                              icon: <AlertCircle className="h-4 w-4" />
                            });
                          }
                        }}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      {/* Update your submit button to use the media handlers */}
                      {/* Find the button that calls handleSubmit and replace with: */}
                      <Button
                        size="lg"
                        className="gap-2 transition-all hover:scale-105"
                        onClick={() => handleSubmit(mediaHandlers)}
                        disabled={
                          (txStatus !== TransactionStatus.IDLE && txStatus !== TransactionStatus.ERROR) ||
                          !isSectionComplete("details") ||
                          !isSectionComplete("polls") ||
                          !isSectionComplete("settings")
                        }
                      >
                        {txStatus !== TransactionStatus.IDLE && txStatus !== TransactionStatus.ERROR ? (
                          <>
                            <div className="flex items-center gap-2">
                              <div className="relative h-4 w-4">
                                <Skeleton className="absolute inset-0 rounded-full animate-pulse" />
                              </div>
                              Creating Vote...
                            </div>
                          </>
                        ) : (
                          <>
                            Create Vote
                            <ArrowRight className="h-4 w-4" />
                          </>
                        )}
                      </Button>
                    </CardFooter>
                  </Card>

                  {/* Preview Card - Mobile Only */}
                  <Card className="mt-6 border-dashed transition-all hover:shadow-md md:hidden">
                    <CardHeader>
                      <CardTitle className="text-lg">Vote Preview</CardTitle>
                      <CardDescription>How your vote will appear to participants</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="rounded-lg border p-4 bg-muted/20">
                        <div className="flex flex-col gap-2">
                          <h3 className="font-semibold text-lg">{voteTitle || "Untitled Vote"}</h3>
                          <p className="text-sm text-muted-foreground">{voteDescription || "No description provided"}</p>

                          <div className="mt-2 flex flex-wrap gap-2">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                              {polls.length} {polls.length === 1 ? "Poll" : "Polls"}
                            </Badge>

                            {votingSettings.requiredToken !== "none" && (
                              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                                Requires {votingSettings.requiredToken.length > 10
                                  ? `${votingSettings.requiredToken.substring(0, 6)}...${votingSettings.requiredToken.substring(votingSettings.requiredToken.length - 4)}`
                                  : votingSettings.requiredToken.toUpperCase()}
                              </Badge>
                            )}

                            {votingSettings.enableWhitelist && (
                              <Badge variant="outline" className="bg-slate-50 text-slate-700 border-slate-200">
                                Whitelist {votingSettings.whitelistWeightsEnabled ? "(Weighted)" : "Only"}
                              </Badge>
                            )}

                            {votingSettings.isTokenWeighted && !(votingSettings.whitelistWeightsEnabled || votingSettings.enableWeightedPayment) && (
                              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                                Token Weighted ({votingSettings.tokenWeight} per vote)
                              </Badge>
                            )}

                            {votingSettings.enableWeightedPayment && (
                              <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">
                                Weighted Payment ({votingSettings.tokenWeight} {votingSettings.requiredToken !== "none" ? "tokens" : "SUI"} per vote)
                              </Badge>
                            )}

                            {Number(votingSettings.paymentAmount) > 0 && (
                              <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                Payment: {votingSettings.paymentAmount} SUI
                              </Badge>
                            )}

                            {showLiveStats && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
                                <BarChart2 className="h-3 w-3 mr-1" />
                                Live Results
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </motion.div>
            </div>
          </Tabs>

          {/* Transaction Status Dialog */}
          <TransactionStatusDialog
            open={txStatusDialogOpen}
            onOpenChange={setTxStatusDialogOpen}
            txStatus={txStatus}
            txDigest={txDigest}
            transactionError={transactionError}
            failedStep={failedStep}
            onRetry={() => {
              setTxStatusDialogOpen(false)
              setTxStatus(TransactionStatus.IDLE)
              setFailedStep(undefined)
            }}
            onSuccess={() => router.push(`/success?digest=${txDigest}`)}
            onClose={() => setTxStatusDialogOpen(false)}
            explorerUrl={SUI_CONFIG.explorerUrl}
            title={{
              default: "Creating Vote",
              success: "Vote Created Successfully!",
              error: "Error Creating Vote"
            }}
            description={{
              default: "Please wait while we create your vote on the blockchain.",
              success: "Your vote has been published to the blockchain.",
              error: "There was an error creating your vote."
            }}
          />
          {/* Media upload is now handled inline in each option */}
        </motion.div>
      )}
    </VoteMediaHandler>
  )
}