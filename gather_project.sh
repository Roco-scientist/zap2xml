#!/bin/bash

# --- Configuration ---
# The name of the file where all the project code will be gathered.
OUTPUT_FILE="project_context.txt"

# Directories to exclude from the search.
EXCLUDE_DIRS=(
    ".git"
    "venv"
    "__pycache__"
    "node_modules"
    "chroma"
    "uploads"
    "logs"
    "project_docs"
    "parsed_docs"
    "migrations"
    "future_ideas"
    "company"
    "assets"
    "deprecated"
    "translations"
    ".venv"
    ".github"
    "chroma"
)

# File patterns to include.
INCLUDE_PATTERNS=(
    "*.py"
    "*.html"
    "*.js"
    "*.ts"
    "*.mjs"
    "*.json"
    "*.sh"
    "*.css"
    "*.md"
    "requirements.txt"
    "*Dockerfile*"
    "docker-compose.*.yml"
    ".env.example"
)

# --- Script Logic ---

# Ensure the script is run from the project root (or a subdir)
if [ ! -d .git ] && [ ! -f "requirements.txt" ] && [ ! -d "templates" ]; then
    echo "Warning: This doesn't look like the root of your project. Run this script from your main project directory."
fi

# Create or clear the output file
> "$OUTPUT_FILE"

echo "Gathering project context into $OUTPUT_FILE..."

# 1. Add the project structure.
echo "--- PROJECT STRUCTURE ---" >> "$OUTPUT_FILE"
# Build the exclude pattern for the 'tree' command
TREE_EXCLUDE_PATTERN=$(IFS="|"; echo "${EXCLUDE_DIRS[*]}")
if command -v tree &> /dev/null; then
    tree -L 3 -I "$TREE_EXCLUDE_PATTERN" >> "$OUTPUT_FILE"
else
    echo "('tree' command not found. Using 'find' for a basic file listing.)" >> "$OUTPUT_FILE"
    # Build the regex for find's -not -regex
    FIND_EXCLUDE_REGEX=".*\($(IFS="|"; echo "${EXCLUDE_DIRS[*]}")\)/.*"
    find . -not -regex "$FIND_EXCLUDE_REGEX" -print | sed -e 's;[^/]*/;|____;g;s;____|; |;g' >> "$OUTPUT_FILE"
fi
echo -e "\n\n" >> "$OUTPUT_FILE"

# 2. Add the README.md file first for context.
echo "--- PROJECT README (High-Level Overview) ---" >> "$OUTPUT_FILE"
if [ -f "README.md" ]; then
    echo "Processing README.md first for context..."
    cat "README.md" >> "$OUTPUT_FILE"
else
    echo "No README.md found in the project root." >> "$OUTPUT_FILE"
fi
echo -e "\n\n" >> "$OUTPUT_FILE"

# 3. Find and concatenate all other matching text files.
echo "--- FILE CONTENTS ---" >> "$OUTPUT_FILE"

# --- This is the corrected section ---
# Start building the find command arguments in an array
find_args=(".")

# Add '-prune' expressions for each directory to be excluded.
# This is the most efficient way to tell 'find' not to descend into these directories.
find_args+=("(")
first_exclude=true
for dir in "${EXCLUDE_DIRS[@]}"; do
    if ! $first_exclude; then
        find_args+=("-o")
    fi
    find_args+=("-path" "./$dir" -o -path "*/$dir")
    first_exclude=false
done
find_args+=(")")
find_args+=("-prune" "-o")

# Now, add the primary expressions for the files we *want* to find.
find_args+=("(")
first_include=true
for pattern in "${INCLUDE_PATTERNS[@]}"; do
    if ! $first_include; then
        find_args+=("-o")
    fi
    find_args+=("-name" "$pattern")
    first_include=false
done
find_args+=(")")

# Add final filters and actions
find_args+=("-a" "-not" "-name" "README.md") # Exclude README to avoid duplication
find_args+=("-a" "-not" "-name" "gather_project.sh") # Exclude README to avoid duplication
find_args+=("-a" "-type" "f") # Only find files
find_args+=("-print0") # Use null-delimiter for safety

# Execute the find command with the properly constructed array of arguments
find "${find_args[@]}" | while IFS= read -r -d $'\0' file; do
    echo "Processing: $file"
    echo "--- FILENAME: $file ---" >> "$OUTPUT_FILE"
    cat "$file" >> "$OUTPUT_FILE"
    echo -e "\n\n" >> "$OUTPUT_FILE"
done
# --- End of corrected section ---

# 4. Specifically list the image files without including their content.
if [ -d "./static/img" ]; then
    echo "--- IMAGES (NOT INCLUDED) ---" >> "$OUTPUT_FILE"
    echo "The following image files are present in ./static/img:" >> "$OUTPUT_FILE"
    find ./static/img -type f >> "$OUTPUT_FILE"
    echo -e "\n" >> "$OUTPUT_FILE"
fi

echo "Done! All code has been gathered into $OUTPUT_FILE."
echo "You can now copy the contents of that file for your prompt."
