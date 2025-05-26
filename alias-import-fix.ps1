Get-ChildItem -Recurse -Include *.ts,*.tsx -Path .\App | ForEach-Object {
    $file = $_.FullName
    $content = Get-Content $file -Raw

    # Regex pattern to match relative paths like ../../components or ../hooks
    $pattern = 'from\s+["' + "'" + '](\.\.\/)+(.+?)["' + "'" + ']'
    $replacement = 'from "@/$2"'

    $updated = [regex]::Replace($content, $pattern, $replacement)

    if ($updated -ne $content) {
        Set-Content -Path $file -Value $updated
        Write-Host "✅ Updated: $file"
    }
}
