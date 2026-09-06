import React from 'react';
import { BackgroundTask } from '../types';
import {
  X,
  Activity,
  CheckCircle2,
  AlertCircle,
  Clock,
  Download,
  Trash2,
  StopCircle,
} from 'lucide-react';

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  tasks: BackgroundTask[];
  onCancelTask: (taskId: string) => void;
  onClearCompletedTasks: () => void;
  isDarkMode: boolean;
}

export const TaskDrawer: React.FC<TaskDrawerProps> = ({
  isOpen,
  onClose,
  tasks,
  onCancelTask,
  onClearCompletedTasks,
  isDarkMode,
}) => {
  if (!isOpen) return null;

  const activeCount = tasks.filter((t) => t.status === 'running' || t.status === 'queued').length;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-xs transition-opacity">
      <div
        id="task-drawer-container"
        className={`w-full max-w-md h-full flex flex-col shadow-xl border-l transition-colors ${
          isDarkMode
            ? 'bg-[#141414] border-[#262626] text-[#e5e5e5]'
            : 'bg-white border-[#e0e0e0] text-[#121212]'
        }`}
      >
        {/* Drawer Header */}
        <div className="p-4 border-b border-inherit flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Activity className={`w-4 h-4 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]'}`} />
            <h3 className="font-semibold text-xs tracking-tight">Background Tasks</h3>
            <span
              className={`px-2 py-0.5 rounded text-xs font-mono font-medium border ${
                activeCount > 0
                  ? isDarkMode
                    ? 'bg-[#f3e79a]/15 text-[#f3e79a] border-[#f3e79a]/30'
                    : 'bg-[#ffd600]/20 text-neutral-900 border-[#ffd600]/40 font-semibold'
                  : isDarkMode
                  ? 'bg-[#222222] text-[#888888] border-[#333333]'
                  : 'bg-[#f0f0f0] text-[#666666] border-[#d8d8d8]'
              }`}
            >
              {activeCount} Active
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {tasks.length > 0 && (
              <button
                onClick={onClearCompletedTasks}
                id="btn-clear-completed-tasks"
                title="Clear completed tasks"
                className={`p-1.5 rounded transition-colors ${
                  isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#252525]' : 'text-[#666666] hover:text-[#111111] hover:bg-[#f0f0f0]'
                }`}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              onClick={onClose}
              id="btn-close-task-drawer"
              className={`p-1.5 rounded transition-colors ${
                isDarkMode ? 'text-[#888888] hover:text-white hover:bg-[#252525]' : 'text-[#666666] hover:text-[#111111] hover:bg-[#f0f0f0]'
              }`}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Task List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2.5">
          {tasks.length === 0 ? (
            <div className="h-48 flex flex-col items-center justify-center text-center text-xs">
              <Clock className="w-8 h-8 mb-2 opacity-30 text-[#888888]" />
              <p className={`font-medium ${isDarkMode ? 'text-[#cccccc]' : 'text-[#444444]'}`}>
                No background tasks registered
              </p>
              <p className={`text-xs mt-0.5 ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                Tasks run concurrently across modules.
              </p>
            </div>
          ) : (
            tasks.map((task) => {
              const isRunning = task.status === 'running' || task.status === 'queued';
              const isCompleted = task.status === 'completed';
              const isFailed = task.status === 'failed';
              const isCancelled = task.status === 'cancelled';

              return (
                <div
                  key={task.id}
                  id={`task-card-${task.id}`}
                  className={`p-3 rounded border transition-all ${
                    isRunning
                      ? isDarkMode
                        ? 'bg-[#1c1c1c] border-[#383838]'
                        : 'bg-[#fdfdfd] border-[#d4d4d4]'
                      : isDarkMode
                      ? 'bg-[#181818] border-[#262626]'
                      : 'bg-white border-[#e0e0e0]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        {isRunning && (
                          <Activity className={`w-3.5 h-3.5 animate-spin flex-shrink-0 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#ca8a04]'}`} />
                        )}
                        {isCompleted && <CheckCircle2 className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />}
                        {isFailed && <AlertCircle className="w-3.5 h-3.5 text-neutral-400 flex-shrink-0" />}
                        {isCancelled && <StopCircle className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />}
                        <h4 className="text-xs font-semibold truncate">{task.title}</h4>
                      </div>
                      <p className={`text-xs mt-0.5 truncate ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                        {task.message}
                      </p>
                    </div>

                    <span className={`text-xs font-mono shrink-0 ${isDarkMode ? 'text-[#f3e79a]' : 'text-[#854d0e]'}`}>
                      ${task.costUSD.toFixed(4)}
                    </span>
                  </div>

                  {/* Progress bar */}
                  {isRunning && (
                    <div className="space-y-1 my-2">
                      <div className={`flex justify-between text-xs font-mono ${isDarkMode ? 'text-[#888888]' : 'text-[#666666]'}`}>
                        <span>Progress</span>
                        <span>{Math.round(task.progress)}%</span>
                      </div>
                      <div className={`w-full h-1.5 rounded-full overflow-hidden ${isDarkMode ? 'bg-[#2b2b2b]' : 'bg-[#e0e0e0]'}`}>
                        <div
                          className={`h-full transition-all duration-300 ${isDarkMode ? 'bg-[#f3e79a]' : 'bg-[#ffd600]'}`}
                          style={{ width: `${task.progress}%` }}
                        />
                      </div>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex items-center justify-between mt-2 pt-2 border-t border-inherit text-xs">
                    <span className={`font-mono text-xs ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
                      {new Date(task.startTime).toLocaleTimeString()}
                    </span>

                    <div className="flex items-center gap-2">
                      {isRunning && (
                        <button
                          onClick={() => onCancelTask(task.id)}
                          id={`btn-cancel-task-${task.id}`}
                          className={`px-2 py-0.5 rounded border transition-colors text-xs ${
                            isDarkMode
                              ? 'text-[#cccccc] hover:text-white bg-[#262626] border-[#383838]'
                              : 'text-[#444444] hover:text-[#111111] bg-[#f0f0f0] border-[#d0d0d0]'
                          }`}
                        >
                          Cancel
                        </button>
                      )}

                      {task.outputDownload && (
                        <a
                          href={task.outputDownload.dataUrl}
                          download={task.outputDownload.filename}
                          id={`btn-download-task-${task.id}`}
                          className={`flex items-center gap-1 px-2.5 py-1 rounded font-medium transition-colors text-xs shadow-xs ${
                            isDarkMode
                              ? 'bg-[#f3e79a] hover:bg-[#e8dc86] text-neutral-950'
                              : 'bg-[#ffd600] hover:bg-[#eab308] text-neutral-950'
                          }`}
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer info */}
        <div className={`p-3 border-t border-inherit text-xs flex items-center justify-between font-mono ${isDarkMode ? 'text-[#777777]' : 'text-[#888888]'}`}>
          <span>Parallel background worker</span>
          <span>In-memory buffers</span>
        </div>
      </div>
    </div>
  );
};
