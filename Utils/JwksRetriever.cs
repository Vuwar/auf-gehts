using Microsoft.IdentityModel.Protocols;
using Microsoft.IdentityModel.Protocols.OpenIdConnect;
using Microsoft.IdentityModel.Tokens;

namespace Api.Utils;

public class JwksRetriever : IConfigurationRetriever<OpenIdConnectConfiguration>
{
    public async Task<OpenIdConnectConfiguration> GetConfigurationAsync(
        string address, IDocumentRetriever retriever, CancellationToken cancel)
    {
        var json = await retriever.GetDocumentAsync(address, cancel);
        var config = new OpenIdConnectConfiguration();
        var jwks = new JsonWebKeySet(json);
        foreach (var key in jwks.GetSigningKeys())
        {
            config.SigningKeys.Add(key);
        }
        return config;
    }
}
