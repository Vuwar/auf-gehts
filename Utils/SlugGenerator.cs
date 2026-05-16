using System.Globalization;
using System.Text;

namespace Api.Utils;

public static class SlugGenerator
{
    public static string Generate(string input)
    {
        if (string.IsNullOrWhiteSpace(input)) return "set";
        var lower = input.ToLowerInvariant().Trim();
        var normalized = lower.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder();
        foreach (var c in normalized)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(c);
            if (cat == UnicodeCategory.NonSpacingMark) continue;
            sb.Append(c);
        }
        var noAccents = sb.ToString().Normalize(NormalizationForm.FormC);

        var clean = new StringBuilder();
        bool lastWasHyphen = true;
        foreach (var c in noAccents)
        {
            if (char.IsLetterOrDigit(c))
            {
                clean.Append(c);
                lastWasHyphen = false;
            }
            else if (!lastWasHyphen)
            {
                clean.Append('-');
                lastWasHyphen = true;
            }
        }
        var result = clean.ToString().Trim('-');
        return string.IsNullOrEmpty(result) ? "set" : result;
    }
}
