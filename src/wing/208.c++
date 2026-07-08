class Solution {
public:
    double findMedianSortedArrays(vector<int>& nums1, vector<int>& nums2) {
        int n=nums1.size(),m=nums2.size();
        if(m>n){
            vector<int> temp=nums2;
            nums2=nums1;
            nums1=temp;
        }
        int left=0,right=m;
        while(left<right){
            int mid=(left+right)/2;
            if(){
                right=mid;
            }else{
                left=mid+1;
            }
        }
    }
};