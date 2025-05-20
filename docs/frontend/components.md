# Key Frontend Components

This page highlights some of the key custom and library components used in the SuiVote frontend.

## Custom Components (`components/`)

These components are specifically built for the SuiVote application.

*   **`AppHeader` and `AppFooter` (`components/app-header.tsx`, `components/app-footer.tsx`):**
    *   Provide consistent navigation and branding across the application.
    *   `AppHeader` typically includes the logo, navigation links, and the wallet connection button.

*   **`WalletConnectButton` (`components/wallet-connect-button.tsx`):**
    *   A dedicated component that integrates with `@suiet/wallet-kit` to handle wallet connection, disconnection, and display of connected wallet information.

*   **`ShareDialog` (`components/share-dialog.tsx`):**
    *   A modal dialog used for sharing vote links via social media or direct link copying.

*   **`DateTimePicker` (`components/date-time-picker.tsx`):**
    *   A custom component likely combining date and time selection, possibly using `react-day-picker` and custom time inputs, for setting vote start and end times.

*   **`TokenSelector` (`components/token-selector.tsx`):**
    *   Allows users to select a specific SUI token, perhaps for token-gated voting requirements. It might fetch a list of known tokens or allow manual input.

*   **`FileUploader` (`components/file-uploader.tsx`):**
    *   (If used) A component for handling file uploads, potentially for images or media associated with polls/options.

*   **Page-Specific Components:** Many pages under `app/` will have their own layout and UI logic, effectively acting as top-level components for those routes (e.g., `VotePage`, `CreatePage`).

## UI Library Components (`components/ui/` - shadcn/ui)

SuiVote utilizes [shadcn/ui](https://ui.shadcn.com/), which provides a set of beautifully designed, accessible, and customizable components built on top of Radix UI and Tailwind CSS.

Commonly used shadcn/ui components include:

*   **`Button`:** For all clickable actions.
*   **`Card`, `CardHeader`, `CardContent`, `CardFooter`, `CardTitle`, `CardDescription`:** For structuring content sections.
*   **`Input`, `Textarea`:** For text input fields.
*   **`Label`:** For associating text with form elements.
*   **`Switch`:** For boolean toggle inputs.
*   **`RadioGroup`, `RadioGroupItem`:** For single-choice selections.
*   **`Checkbox`:** For multiple-choice selections or boolean checks.
*   **`Dialog`, `DialogContent`, etc.:** For modal pop-ups.
*   **`Alert`, `AlertTitle`, `AlertDescription`:** For displaying important messages.
*   **`Badge`:** For small status indicators.
*   **`Separator`:** For visual dividers.
*   **`Tabs`, `TabsList`, `TabsTrigger`, `TabsContent`:** For tabbed navigation.
*   **`Tooltip`:** For displaying informational text on hover.
*   **`Progress`:** For displaying progress bars (e.g., for transaction status).
*   **`Skeleton`:** For loading state placeholders.

## Icons (`lucide-react`)

[Lucide React](https://lucide.dev/) is used for a comprehensive set of SVG icons, providing a consistent visual style.

## Wallet Integration (`@suiet/wallet-kit`)

While not a UI component in itself, `@suiet/wallet-kit` provides the necessary hooks (`useWallet`) and context (`WalletProvider`) that are integrated into UI components (like `WalletConnectButton`) to manage wallet interactions.

This combination of custom components, a robust UI library, and specialized packages allows for a rich and interactive user experience in SuiVote.