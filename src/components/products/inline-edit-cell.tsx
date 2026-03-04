"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { safeDecimal } from "@/lib/utils/decimal"

interface InlineEditCellProps {
    initialValue: string | number | null | undefined;
    onSave: (value: string | number) => void;
    type?: 'text' | 'number' | 'price';
    formatDisplay?: (value: any) => React.ReactNode;
}

export function InlineEditCell({ initialValue, onSave, type = 'text', formatDisplay }: InlineEditCellProps) {
    const [isEditing, setIsEditing] = React.useState(false);
    const [value, setValue] = React.useState(initialValue?.toString() || "");
    const inputRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        setValue(initialValue?.toString() || "");
    }, [initialValue]);

    React.useEffect(() => {
        if (isEditing && inputRef.current) {
            inputRef.current.focus();
        }
    }, [isEditing]);

    const handleDoubleClick = () => {
        setIsEditing(true);
    };

    const handleBlur = () => {
        setIsEditing(false);
        saveValue();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter') {
            setIsEditing(false);
            saveValue();
        } else if (e.key === 'Escape') {
            setIsEditing(false);
            setValue(initialValue?.toString() || "");
        }
    };

    const saveValue = () => {
        if (value === initialValue?.toString()) return;

        if (type === 'price') {
            if (!value) {
                onSave("0.0000");
                return;
            }
            try {
                const formatted = safeDecimal(value).toFixed(4);
                onSave(formatted);
                setValue(formatted); // Optimistic visual update
            } catch (e) {
                setValue(initialValue?.toString() || "");
            }
        } else if (type === 'number') {
            onSave(Number(value));
        } else {
            onSave(value);
        }
    };

    if (isEditing) {
        return (
            <Input
                ref={inputRef}
                type={type === 'text' ? 'text' : 'number'}
                step={type === 'price' ? '0.0001' : '1'}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                onBlur={handleBlur}
                onKeyDown={handleKeyDown}
                className="h-8 py-1 px-2 text-sm w-full min-w-[80px]"
            />
        );
    }

    return (
        <div
            className="cursor-pointer min-h-[24px] px-2 py-1 -mx-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors"
            onDoubleClick={handleDoubleClick}
            title="Düzenlemek için çift tıklayın"
        >
            {formatDisplay && initialValue !== null && initialValue !== undefined
                ? formatDisplay(initialValue)
                : initialValue?.toString() || <span className="text-muted-foreground italic">-</span>}
        </div>
    );
}
