import { createContext, useContext, useState } from "react";

const DialogContext = createContext(null);

export function CustomDialogProvider({ children }) {
  const [dialog, setDialog] = useState(null);

  const closeDialog = () => setDialog(null);

  const alertBox = ({ title = "Notice", message }) => {
    return new Promise((resolve) => {
      setDialog({
        type: "alert",
        title,
        message,
        onConfirm: () => {
          closeDialog();
          resolve(true);
        },
      });
    });
  };

  const confirmBox = ({ title = "Confirm", message }) => {
    return new Promise((resolve) => {
      setDialog({
        type: "confirm",
        title,
        message,
        onConfirm: () => {
          closeDialog();
          resolve(true);
        },
        onCancel: () => {
          closeDialog();
          resolve(false);
        },
      });
    });
  };

  const promptBox = ({ title = "Input Required", message, defaultValue = "" }) => {
    return new Promise((resolve) => {
      setDialog({
        type: "prompt",
        title,
        message,
        inputValue: defaultValue,
        onConfirm: (value) => {
          closeDialog();
          resolve(value);
        },
        onCancel: () => {
          closeDialog();
          resolve(null);
        },
      });
    });
  };

  return (
    <DialogContext.Provider value={{ alertBox, confirmBox, promptBox }}>
      {children}
      {dialog && <DialogModal dialog={dialog} setDialog={setDialog} />}
    </DialogContext.Provider>
  );
}

export function useDialog() {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error("useDialog must be used inside CustomDialogProvider");
  }
  return context;
}

function DialogModal({ dialog, setDialog }) {
  const [inputValue, setInputValue] = useState(dialog.inputValue || "");

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h3 style={styles.title}>{dialog.title}</h3>
        <p style={styles.message}>{dialog.message}</p>

        {dialog.type === "prompt" && (
          <input
            autoFocus
            style={styles.input}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
          />
        )}

        <div style={styles.actions}>
          {dialog.type !== "alert" && (
            <button style={styles.cancelBtn} onClick={dialog.onCancel}>
              Cancel
            </button>
          )}

          <button
            style={styles.confirmBtn}
            onClick={() =>
              dialog.type === "prompt"
                ? dialog.onConfirm(inputValue)
                : dialog.onConfirm()
            }
          >
            {dialog.type === "alert" ? "OK" : "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: "fixed",
    inset: 0,
    backgroundColor: "rgba(15, 23, 42, 0.65)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 9999,
  },
  modal: {
    backgroundColor: "white",
    width: "100%",
    maxWidth: "420px",
    borderRadius: "12px",
    padding: "24px",
    boxShadow: "0 25px 50px rgba(0,0,0,0.25)",
  },
  title: {
    margin: "0 0 8px 0",
    fontSize: "20px",
    color: "#0f172a",
  },
  message: {
    margin: "0 0 20px 0",
    fontSize: "14px",
    color: "#475569",
    lineHeight: 1.5,
  },
  input: {
    width: "100%",
    padding: "10px",
    border: "1px solid #cbd5e1",
    borderRadius: "6px",
    marginBottom: "20px",
    boxSizing: "border-box",
  },
  actions: {
    display: "flex",
    justifyContent: "flex-end",
    gap: "10px",
  },
  cancelBtn: {
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #cbd5e1",
    padding: "8px 14px",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
  },
  confirmBtn: {
    backgroundColor: "#3b82f6",
    color: "white",
    border: "none",
    padding: "8px 14px",
    borderRadius: "6px",
    fontWeight: "bold",
    cursor: "pointer",
  },
};