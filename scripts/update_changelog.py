#!/usr/bin/env python3
import sys
import subprocess
from datetime import datetime
from pathlib import Path

def get_git_info(commit_msg_arg=None):
    # 1) Get date
    date_str = datetime.today().strftime('%Y-%m-%d')
    
    # 2) Get description
    if commit_msg_arg:
        desc = commit_msg_arg.strip()
    else:
        try:
            desc = subprocess.check_output(
                ["git", "log", "-1", "--pretty=%B"], 
                text=True
            ).strip()
        except Exception:
            desc = "Manual update"
            
    # 3) Get files affected (staged or unstaged)
    try:
        status_out = subprocess.check_output(
            ["git", "status", "--porcelain"],
            text=True
        ).strip().split('\n')
        
        files = []
        for line in status_out:
            if not line.strip():
                continue
            parts = line.strip().split(None, 1)
            if len(parts) > 1:
                files.append(parts[1].strip('"'))
            
        if not files:
            files = subprocess.check_output(
                ["git", "diff-tree", "--no-commit-id", "--name-only", "-r", "HEAD"],
                text=True
            ).strip().split('\n')
            
        # Filter out empty strings, docs, script itself, and .gemini files
        files = [f for f in files if f and f != "REACH_APP_DOCUMENTATION.md" and f != "scripts/update_changelog.py" and not f.startswith(".gemini")]
    except Exception:
        files = []
        
    if not files:
        files = ["Multiple files"]
        
    files_str = ", ".join(f"`{f}`" for f in files)
    return date_str, desc, files_str

def main():
    commit_msg = sys.argv[1] if len(sys.argv) > 1 else None
    date_str, desc, files_str = get_git_info(commit_msg)
    
    # Remove any git hash/metadata if it was passed automatically
    if desc.startswith("commit "):
        desc = desc.split("\n", 1)[-1].strip()
        
    # Replace newlines in description with spaces/breaks
    desc_cleaned = desc.replace("\n", " ").replace("|", "\\|")
    
    doc_path = Path(__file__).resolve().parent.parent / "REACH_APP_DOCUMENTATION.md"
    if not doc_path.exists():
        print(f"Error: {doc_path} not found.")
        sys.exit(1)
        
    content = doc_path.read_text(encoding="utf-8")
    
    # Find the Change Log section
    header = "## 13. Change Log"
    if header not in content:
        print(f"Error: Change Log section header not found.")
        sys.exit(1)
        
    lines = content.splitlines()
    header_idx = -1
    for i, line in enumerate(lines):
        if header in line:
            header_idx = i
            break
            
    # Find the last table row
    last_table_idx = -1
    for i in range(header_idx + 1, len(lines)):
        if lines[i].strip().startswith("|"):
            last_table_idx = i
            
    if last_table_idx == -1:
        print("Error: Change Log table not found.")
        sys.exit(1)
        
    # Format entry
    new_row = f"| {date_str} | {desc_cleaned} | {files_str} |"
    
    # Insert new row (with a blank line before to match existing formatting)
    lines.insert(last_table_idx + 1, "")
    lines.insert(last_table_idx + 2, new_row)
    
    # Update the "Last updated" line if it exists
    for i in range(last_table_idx + 2, len(lines)):
        if "Last updated:" in lines[i]:
            lines[i] = f"*Last updated: {date_str}*"
            break
            
    # Write back
    doc_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Successfully added to Change Log: {new_row}")

if __name__ == "__main__":
    main()
