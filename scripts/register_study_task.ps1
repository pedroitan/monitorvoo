# Registra a coleta horaria do estudo Colombia no Agendador de Tarefas do Windows.
# Uso (PowerShell, na raiz do repo):  .\scripts\register_study_task.ps1
# Remover:                             Unregister-ScheduledTask -TaskName MonitorVoo-Study -Confirm:$false

$ErrorActionPreference = "Stop"
$repo = Split-Path -Parent $PSScriptRoot
$python = (Get-Command python).Source
$taskName = "MonitorVoo-Study"

$action = New-ScheduledTaskAction -Execute $python -Argument "-m collectors.study" -WorkingDirectory $repo

# Toda hora cheia, indefinidamente, a partir da proxima hora.
$start = (Get-Date).Date.AddHours((Get-Date).Hour + 1)
$trigger = New-ScheduledTaskTrigger -Once -At $start -RepetitionInterval (New-TimeSpan -Hours 1)

$settings = New-ScheduledTaskSettingsSet `
    -WakeToRun `
    -StartWhenAvailable `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -MultipleInstances IgnoreNew `
    -ExecutionTimeLimit (New-TimeSpan -Minutes 55)

Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
    -Description "MonitorVoo: coleta horaria do estudo Colombia (collectors.study)" -Force | Out-Null

# Sem isso o PC nao acorda sozinho para a coleta da madrugada.
powercfg /SETACVALUEINDEX SCHEME_CURRENT SUB_SLEEP RTCWAKE 1 | Out-Null
powercfg /SETACTIVE SCHEME_CURRENT | Out-Null

Write-Host "Tarefa '$taskName' registrada. Primeira execucao: $start"
Write-Host "Python: $python"
Write-Host "Logs: $repo\logs\study-AAAA-MM-DD.log"
