namespace Api.Services.Audio;

public class AzureSpeechOptions
{
    public string? Key { get; set; }
    public string? Region { get; set; }
    public string Voice { get; set; } = "de-DE-KatjaNeural";
    public string Language { get; set; } = "de-DE";
    public string Format { get; set; } = "audio-24khz-48kbitrate-mono-mp3";
}
