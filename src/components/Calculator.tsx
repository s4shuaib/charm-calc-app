import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { X, Delete } from "lucide-react";

interface CalculatorProps {
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
}

export const Calculator = ({ value, onChange, onClose }: CalculatorProps) => {
  const [expression, setExpression] = useState(value || "");
  const [result, setResult] = useState("");

  useEffect(() => {
    if (expression) {
      try {
        // Replace × and ÷ with * and /
        const evalExpression = expression
          .replace(/×/g, "*")
          .replace(/÷/g, "/");
        const calculated = eval(evalExpression);
        setResult(calculated.toFixed(2));
      } catch {
        setResult("");
      }
    } else {
      setResult("");
    }
  }, [expression]);

  const handleButtonClick = (value: string) => {
    if (value === "AC") {
      setExpression("");
      setResult("");
    } else if (value === "⌫") {
      setExpression(prev => prev.slice(0, -1));
    } else if (value === "=") {
      if (result) {
        setExpression(result);
        onChange(result);
      }
    } else if (value === "→") {
      onChange(expression || result || "0");
      onClose();
    } else {
      setExpression(prev => prev + value);
    }
  };

  const buttons = [
    ["AC", "%", "÷", "⌫"],
    ["7", "8", "9", "×"],
    ["4", "5", "6", "-"],
    ["1", "2", "3", "+"],
    [".", "0", "=", "→"]
  ];

  const getButtonClass = (btn: string) => {
    if (btn === "AC") return "bg-destructive/10 text-destructive hover:bg-destructive/20";
    if (btn === "→") return "bg-primary text-primary-foreground hover:bg-primary/90";
    if (["%", "÷", "×", "-", "+", "="].includes(btn)) return "bg-primary/10 text-primary hover:bg-primary/20";
    if (btn === "⌫") return "bg-muted hover:bg-muted/80";
    return "bg-card hover:bg-muted";
  };

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="text-lg font-semibold">Amount Calculator</h2>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-5 w-5" />
        </Button>
      </div>

      {/* Display */}
      <div className="p-6 space-y-2">
        <div className="text-right text-3xl font-semibold min-h-[48px] break-all">
          {expression || "0"}
        </div>
        {result && (
          <div className="text-right text-2xl text-primary font-semibold">
            = {result}
          </div>
        )}
      </div>

      {/* Calculator Pad */}
      <div className="flex-1 p-4">
        <div className="grid grid-cols-4 gap-3 max-w-md mx-auto">
          {buttons.flat().map((btn) => (
            <Button
              key={btn}
              onClick={() => handleButtonClick(btn)}
              className={`h-16 text-xl font-semibold ${getButtonClass(btn)}`}
              variant="outline"
            >
              {btn === "⌫" ? <Delete className="h-6 w-6" /> : btn}
            </Button>
          ))}
        </div>
      </div>
    </div>
  );
};
