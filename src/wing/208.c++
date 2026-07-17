class Solution {
public:
    bool wordBreak(string s, vector<string>& wordDict) {
        vector<string> str;
        string  tmp;
        
        for(int i=0;i<s.size();i++){
            tmp+=s[i];
            str.push_back(tmp);
        }
        tmp="";
        for(int i=0;i<str.size();i++){
            tmp=s[i];
            for(int j=0;j<wordDict.size();j++){
                int len=wordDict[j];
                string un_tmp=str[i-len];
                string xx=un_tmp+wordBreak[j];
                if(tmp==xx) str[i]=1;
            }
        }

        if(str[s.size()-1]==1) return true;
        else return false;      
    }
};