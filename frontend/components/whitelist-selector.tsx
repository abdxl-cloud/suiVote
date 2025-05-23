"use client"

import { useState, useEffect, useRef } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { AlertCircle, X, Clipboard, ClipboardCheck, Download, Upload, Trash2, Plus, Users } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { toast } from "sonner"

interface WhitelistSelectorProps {
  enableWhitelist: boolean
  onWhitelistChange: (enabled: boolean) => void
  whitelistAddresses: string[]
  onWhitelistAddressesChange: (addresses: string[]) => void
  className?: string
}

export function WhitelistSelector({
  enableWhitelist,
  onWhitelistChange,
  whitelistAddresses,
  onWhitelistAddressesChange,
  className,
}: WhitelistSelectorProps) {
  const [whitelistInput, setWhitelistInput] = useState("")
  const [whitelistError, setWhitelistError] = useState<string | null>(null)
  const [invalidAddresses, setInvalidAddresses] = useState<string[]>([])
  const [duplicateCount, setDuplicateCount] = useState(0)
  const [clipboardSupported, setClipboardSupported] = useState(false)
  const [isClipboardCopied, setIsClipboardCopied] = useState(false)
  const [activeTab, setActiveTab] = useState<string>("input")
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Check if clipboard API is available
  useEffect(() => {
    setClipboardSupported(!!navigator.clipboard);
  }, []);

  // Update the textarea when addresses are changed externally
  useEffect(() => {
    if (whitelistAddresses.length > 0 && whitelistInput === "") {
      setWhitelistInput(whitelistAddresses.join("\n"));
    }
  }, [whitelistAddresses, whitelistInput]);

  const isValidSuiAddress = (address: string): boolean => {
    // Valid Sui address: 0x followed by 64 hex characters
    const suiAddressRegex = /^0x[a-fA-F0-9]{64}$/;
    return suiAddressRegex.test(address);
  }

  const processAddresses = (input: string) => {
    // Split by spaces, semicolons, commas, or newlines
    const allAddresses = input
      .split(/[\s;,\n]+/)
      .map(addr => addr.trim())
      .filter(addr => addr.length > 0);
    
    // Separate valid from invalid addresses
    const valid: string[] = [];
    const invalid: string[] = [];
    
    allAddresses.forEach(addr => {
      // Basic check: must start with 0x
      if (!addr.startsWith('0x')) {
        invalid.push(addr);
      } 
      // Full validation
      else if (!isValidSuiAddress(addr)) {
        invalid.push(addr);
      } 
      // It's valid
      else {
        valid.push(addr);
      }
    });
    
    // Remove duplicates and count them
    const uniqueAddresses = [...new Set(valid)];
    const duplicatesFound = valid.length - uniqueAddresses.length;
    setDuplicateCount(duplicatesFound);
    
    // Update state with only valid, unique addresses
    onWhitelistAddressesChange(uniqueAddresses);
    setInvalidAddresses(invalid);
    
    // Set error message if needed
    if (invalid.length > 0) {
      setWhitelistError(`${invalid.length} invalid address(es) found and removed.`);
    } else if (duplicatesFound > 0) {
      setWhitelistError(null); // Not really an error
    } else {
      setWhitelistError(null);
    }
  }

  // Remove a specific address
  const removeAddress = (addressToRemove: string) => {
    const updatedAddresses = whitelistAddresses.filter(
      addr => addr !== addressToRemove
    );
    onWhitelistAddressesChange(updatedAddresses);
    
    // Update the textarea to reflect the change
    setWhitelistInput(updatedAddresses.join("\n"));
    
    toast.success("Address removed from whitelist");
  }
  
  // Copy all addresses to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(whitelistAddresses.join('\n'));
      setIsClipboardCopied(true);
      toast.success("Addresses copied to clipboard");
      
      // Reset the copied state after 2 seconds
      setTimeout(() => {
        setIsClipboardCopied(false);
      }, 2000);
    } catch (err) {
      toast.error("Failed to copy addresses to clipboard");
    }
  }
  
  // Download addresses as a text file
  const downloadAddresses = () => {
    const blob = new Blob([whitelistAddresses.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'whitelist-addresses.txt';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    toast.success("Addresses downloaded as text file");
  }
  
  // Clear all addresses
  const clearAllAddresses = () => {
    if (whitelistAddresses.length === 0) return;
    
    onWhitelistAddressesChange([]);
    setWhitelistInput("");
    toast.success("All addresses cleared");
  }
  
  // Trigger file input click
  const triggerFileUpload = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  }
  
  // Paste from clipboard
  const pasteFromClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      setWhitelistInput(text);
      processAddresses(text);
      toast.success("Addresses pasted from clipboard");
    } catch (err) {
      toast.error("Failed to paste from clipboard");
    }
  }

  return (
    <div className={cn("space-y-4", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-primary" />
          <Label htmlFor="whitelist-toggle" className="text-sm font-medium cursor-pointer">
            Enable address whitelist
          </Label>
        </div>
        <div className="flex items-center space-x-2">
          <Label htmlFor="whitelist-toggle" className="text-xs text-muted-foreground cursor-pointer">
            {enableWhitelist ? "On" : "Off"}
          </Label>
          <Switch
            id="whitelist-toggle"
            checked={enableWhitelist}
            onCheckedChange={onWhitelistChange}
          />
        </div>
      </div>
      
      {enableWhitelist && (
        <div className="space-y-3 pt-2 animate-in fade-in-50 duration-300">
          <Tabs defaultValue="input" value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-2 mb-4">
              <TabsTrigger value="input" className="text-sm">
                Text Input
              </TabsTrigger>
              <TabsTrigger value="list" className="text-sm">
                Address List 
                {whitelistAddresses.length > 0 && (
                  <Badge variant="secondary" className="ml-2 text-xs">
                    {whitelistAddresses.length}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>
          
            <TabsContent value="input" className="space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="whitelist-addresses" className="text-sm">
                    Enter addresses
                  </Label>
                  
                  <div className="flex gap-1">
                    {clipboardSupported && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs"
                        onClick={pasteFromClipboard}
                        title="Paste addresses from clipboard"
                      >
                        <Clipboard className="h-3.5 w-3.5 mr-1" />
                        <span className="hidden sm:inline">Paste</span>
                      </Button>
                    )}
                    
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={triggerFileUpload}
                      title="Upload addresses from file"
                    >
                      <Upload className="h-3.5 w-3.5 mr-1" />
                      <span className="hidden sm:inline">Upload</span>
                    </Button>
                  </div>
                </div>
                
                <Textarea
                  id="whitelist-addresses"
                  placeholder="Enter wallet addresses separated by spaces, commas, or newlines..."
                  value={whitelistInput}
                  onChange={(e) => {
                    setWhitelistInput(e.target.value);
                    processAddresses(e.target.value);
                  }}
                  className="min-h-[120px] font-mono text-xs transition-all focus:scale-[1.01]"
                />
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1">
                  <div className="text-xs px-2 py-1 bg-muted/40 rounded flex items-center justify-between">
                    <span>Total addresses:</span>
                    <Badge variant="outline">{whitelistAddresses.length}</Badge>
                  </div>
                  
                  {invalidAddresses.length > 0 && (
                    <div className="text-xs px-2 py-1 bg-red-50/30 dark:bg-red-950/30 text-red-600 dark:text-red-400 rounded flex items-center justify-between">
                      <span>Invalid:</span>
                      <Badge variant="outline" className="text-red-600 dark:text-red-400 border-red-200 dark:border-red-800">
                        {invalidAddresses.length}
                      </Badge>
                    </div>
                  )}
                  
                  {duplicateCount > 0 && (
                    <div className="text-xs px-2 py-1 bg-amber-50/30 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400 rounded flex items-center justify-between">
                      <span>Duplicates:</span>
                      <Badge variant="outline" className="text-amber-600 dark:text-amber-400 border-amber-200 dark:border-amber-800">
                        {duplicateCount}
                      </Badge>
                    </div>
                  )}
                </div>
                
                {whitelistError && (
                  <Alert variant="destructive" className="py-2 text-sm">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription className="text-xs">{whitelistError}</AlertDescription>
                  </Alert>
                )}
                
                {invalidAddresses.length > 0 && (
                  <div className="text-xs text-red-500 mt-1 p-2 border border-red-200 dark:border-red-900 rounded bg-red-50/30 dark:bg-red-950/30">
                    <div className="font-medium mb-1">Invalid addresses:</div>
                    <div className="font-mono overflow-x-auto whitespace-nowrap max-w-full">
                      {invalidAddresses.slice(0, 3).join(", ")}
                      {invalidAddresses.length > 3 && <span> and {invalidAddresses.length - 3} more</span>}
                    </div>
                  </div>
                )}
                
                <Input
                  ref={fileInputRef}
                  id="whitelist-file"
                  type="file"
                  accept=".txt,.csv"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const content = event.target?.result as string;
                        // Set the textarea content
                        setWhitelistInput(content);
                        processAddresses(content);
                        toast.success(`File "${file.name}" uploaded successfully`);
                      };
                      reader.onerror = () => {
                        toast.error("Error reading file");
                      };
                      reader.readAsText(file);
                    }
                  }}
                />
              </div>
            </TabsContent>
            
            <TabsContent value="list" className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                
                <div className="flex gap-1">
                  {clipboardSupported && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-8 px-2 text-xs"
                      onClick={copyToClipboard}
                      disabled={whitelistAddresses.length === 0}
                      title="Copy all addresses to clipboard"
                    >
                      {isClipboardCopied ? (
                        <ClipboardCheck className="h-3.5 w-3.5 mr-1 text-green-500" />
                      ) : (
                        <Clipboard className="h-3.5 w-3.5 mr-1" />
                      )}
                      <span className="hidden sm:inline">Copy All</span>
                    </Button>
                  )}
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={downloadAddresses}
                    disabled={whitelistAddresses.length === 0}
                    title="Download addresses as text file"
                  >
                    <Download className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 px-2 text-xs text-red-500 hover:text-red-700 hover:bg-red-50/50 dark:hover:bg-red-950/50"
                    onClick={clearAllAddresses}
                    disabled={whitelistAddresses.length === 0}
                    title="Clear all addresses"
                  >
                    <Trash2 className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                  
                  <Button
                    variant="default"
                    size="sm"
                    className="h-8 px-2 text-xs"
                    onClick={() => setActiveTab("input")}
                    title="Add more addresses"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    <span className="hidden sm:inline">Add More</span>
                  </Button>
                </div>
              </div>
              
              {whitelistAddresses.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-8 border border-dashed rounded-md bg-muted/30">
                  <Users className="h-8 w-8 text-muted-foreground/60 mb-2" />
                  <p className="text-sm text-muted-foreground">No addresses added yet</p>
                  <Button 
                    variant="link" 
                    className="text-xs mt-2" 
                    onClick={() => setActiveTab("input")}
                  >
                    Add addresses
                  </Button>
                </div>
              ) : (
                <div className="border rounded-md p-3 max-h-[300px] overflow-y-auto bg-muted/20">
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
                    {whitelistAddresses.map((address, index) => (
                      <Badge 
                        key={index} 
                        variant="outline"
                        className="flex items-center justify-between gap-1 py-1.5 px-2 transition-all hover:bg-accent/50 group"
                      >
                        <span className="truncate text-xs font-mono">
                          {address.substring(0, 8)}...{address.substring(address.length - 6)}
                        </span>
                        <button
                          onClick={() => removeAddress(address)}
                          className="text-muted-foreground opacity-50 group-hover:opacity-100 hover:text-red-500 transition-all"
                          aria-label="Remove address"
                          title={address}
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              
              <p className="text-xs text-muted-foreground italic">
                Only these addresses will be able to vote on this poll.
              </p>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  )
}